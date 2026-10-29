import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServices } from '../services/app-services';
import { SERVER_ADDRESS_KEY, ServerChange, normalizeServerAddress, serverLabel } from '../services/server-address';

export function useServerAddress() {
  const { config, server, store, probeServer } = useServices();
  const client = useQueryClient();
  const [address, setAddress] = useState(() => server.current());
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<ServerChange>();
  const change = async (typed: string): Promise<boolean> => {
    const next = normalizeServerAddress(typed, server.current());
    if (!next) {
      setProblem(ServerChange.Invalid);
      return false;
    }
    setChecking(true);
    setProblem(undefined);
    try {
      if (!(await probeServer(next))) {
        setProblem(ServerChange.Unreachable);
        return false;
      }
      server.set(next);
      await store.set(SERVER_ADDRESS_KEY, next);
      setAddress(next);
      await client.invalidateQueries();
      return true;
    } finally {
      setChecking(false);
    }
  };
  return {
    allowed: config.api.allowServerChange,
    address,
    label: serverLabel(address),
    checking,
    problemKey: problem ? `server.errors.${problem}` : undefined,
    change,
  };
}
