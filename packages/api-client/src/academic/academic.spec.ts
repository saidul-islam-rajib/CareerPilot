import { describe, expect, it } from "vitest";
import {
  AcademicFailure,
  DecisionKind,
  ExamStatus,
  NeedLevel,
  OutreachStatus,
  ReceiptEvidence,
  RecommendationStatus,
  ReplyOutcome,
  UserAction,
} from "@careerpilot/domain-ui-logic";
import { ApiErrorCode } from "../errors";
import { createTestApi } from "../test-support";
import { HttpMethod, type HttpClient } from "../http/http-client";
import { createHttpAcademic, offersQuery } from "./http";
import {
  emptyDecision,
  emptyStudyExamRequirement,
  emptyExamInput,
  emptyOutreachDraft,
  emptyProgramInput,
  emptyRecommendationInput,
  emptyRefereeInput,
} from "./defaults";

const WORK = "graph neural networks for protein design";

function program(title = "MSc Data Science") {
  return { ...emptyProgramInput(), title, university: "Northern University" };
}

describe("in-memory academic", () => {
  it("creates a program from a study opportunity once and refuses jobs", async () => {
    const { academic } = createTestApi();
    const created =
      await academic.createProgramFromOpportunity("opp_masters_tum");
    expect(created).toMatchObject({
      university: "Alpine Technical University",
      countryCode: "DE",
      opportunityId: "opp_masters_tum",
    });
    expect(created.examRequirements).toEqual([]);
    await expect(
      academic.createProgramFromOpportunity("opp_masters_tum"),
    ).rejects.toMatchObject({ code: ApiErrorCode.Conflict });
    await expect(
      academic.createProgramFromOpportunity("opp_remote_frontend"),
    ).rejects.toMatchObject({ detail: AcademicFailure.NotAStudyOpportunity });
  });

  it("computes score expiry and warns when it falls before the deadline", async () => {
    const { academic } = createTestApi();
    const exam = await academic.createExam({
      ...emptyExamInput(),
      status: ExamStatus.ScoresReleased,
      scoreReleaseOn: "2026-03-14",
      validityMonths: 6,
      scores: { overall: 7, sections: {} },
    });
    expect(exam.expiresOn).toBe("2026-09-14");
    const created = await academic.createProgram({
      ...program(),
      examRequirements: [
        { ...emptyStudyExamRequirement(), need: NeedLevel.Required },
      ],
      deadlines: [
        { kind: "application", on: "2027-01-15", note: "", sourceUrl: "" },
      ],
    });
    const plan = await academic.plan(created.id);
    expect(plan.warnings.map((w) => w.kind)).toEqual([
      "score_expires_before_deadline",
    ]);
  });

  it("refuses referee use without consent and recommendation proof without evidence", async () => {
    const { academic } = createTestApi();
    const created = await academic.createProgram(program());
    const referee = await academic.createReferee({
      ...emptyRefereeInput(),
      name: "Dr Rahim",
    });
    await expect(
      academic.createRecommendation(
        emptyRecommendationInput(referee.id, created.id),
      ),
    ).rejects.toMatchObject({
      detail: AcademicFailure.RefereeConsentRequired,
    });
    await academic.setRefereeConsent(referee.id, true);
    const recommendation = await academic.createRecommendation(
      emptyRecommendationInput(referee.id, created.id),
    );
    await expect(
      academic.setRecommendationStatus(recommendation.id, {
        status: RecommendationStatus.Submitted,
      }),
    ).rejects.toMatchObject({
      detail: AcademicFailure.EvidenceRequired,
    });
    const submitted = await academic.setRecommendationStatus(
      recommendation.id,
      {
        status: RecommendationStatus.Submitted,
        evidence: ReceiptEvidence.UserStatement,
        evidenceNote: "emailed me",
      },
    );
    expect(submitted.status).toBe(RecommendationStatus.Submitted);
    await academic.setRefereeConsent(referee.id, false);
    await expect(
      academic.recommendationDraft(recommendation.id, "request"),
    ).rejects.toMatchObject({ code: ApiErrorCode.Validation });
  });

  it("drafts outreach from the real work, enforces limits and stops after a decline", async () => {
    const { academic } = createTestApi();
    await expect(
      academic.draftOutreach({
        ...emptyOutreachDraft(),
        supervisorName: "Prof Lee",
        university: "Northern",
        researchReference: "AI",
      }),
    ).rejects.toMatchObject({
      detail: AcademicFailure.ResearchReferenceRequired,
    });
    const draft = await academic.draftOutreach({
      ...emptyOutreachDraft(),
      supervisorName: "Prof Lee",
      university: "Northern",
      department: "CS",
      researchReference: WORK,
    });
    expect(draft.status).toBe(OutreachStatus.Draft);
    expect(draft.body).toContain(WORK);
    await academic.updateSettings({ maxPerDay: 1 });
    const second = await academic.draftOutreach({
      ...emptyOutreachDraft(),
      supervisorName: "Prof Kim",
      university: "Northern",
      researchReference: WORK,
    });
    const sent = await academic.markOutreachSent(draft.id);
    expect(sent.status).toBe(OutreachStatus.Sent);
    await expect(academic.markOutreachSent(second.id)).rejects.toMatchObject({
      detail: AcademicFailure.OutreachLimit,
    });
    const declined = await academic.recordOutreachReply(
      draft.id,
      ReplyOutcome.Declined,
    );
    expect(declined.doNotContact).toBe(true);
    await expect(
      academic.markOutreachSent(draft.id, "2027-01-01"),
    ).rejects.toMatchObject({ detail: AcademicFailure.OutreachStopped });
    await expect(
      academic.updateSettings({ maxPerDay: 500 }),
    ).rejects.toMatchObject({ detail: AcademicFailure.LimitAboveMaximum });
  });

  it("records offer actions only with confirmation and builds the checklist", async () => {
    const { academic } = createTestApi();
    const created = await academic.createProgram({
      ...program(),
      startsOn: "2027-09-01",
      decision: { ...emptyDecision(), kind: DecisionKind.Accepted },
    });
    await expect(
      academic.recordAction(created.id, UserAction.AcceptOffer, false),
    ).rejects.toMatchObject({ detail: AcademicFailure.ConfirmationRequired });
    const done = await academic.recordAction(
      created.id,
      UserAction.AcceptOffer,
      true,
    );
    expect(done.decision?.actions).toHaveLength(1);
    const withList = await academic.generateChecklist(created.id);
    expect(withList.checklist).toHaveLength(8);
    expect(withList.checklist.find((c) => c.step === "visa")?.dueOn).toBe(
      "2027-06-03",
    );
    expect(await academic.compareOffers()).toHaveLength(1);
  });
});

describe("http academic", () => {
  it("maps calls to the academic routes", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const http = {
      request: async (method: string, path: string, body?: unknown) => {
        calls.push({ method, path, body });
        return {} as never;
      },
    } as unknown as HttpClient;
    const api = createHttpAcademic(http);
    await api.plan("p 1");
    await api.setRefereeConsent("r1", true);
    await api.compareOffers(["a", "b"]);
    await api.recordOutreachReply("o1", ReplyOutcome.Positive);
    expect(calls).toEqual([
      {
        method: HttpMethod.Get,
        path: "/v1/academic/programs/p%201/plan",
        body: undefined,
      },
      {
        method: HttpMethod.Put,
        path: "/v1/academic/referees/r1/consent",
        body: { confirmed: true },
      },
      {
        method: HttpMethod.Get,
        path: "/v1/academic/offers/compare?ids=a%2Cb",
        body: undefined,
      },
      {
        method: HttpMethod.Post,
        path: "/v1/academic/outreach/o1/reply",
        body: { outcome: "positive", note: "" },
      },
    ]);
    expect(offersQuery()).toBe("");
  });
});
