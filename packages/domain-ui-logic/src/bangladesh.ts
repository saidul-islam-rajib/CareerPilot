export const BD_DIVISIONS = ['barishal', 'chattogram', 'dhaka', 'khulna', 'mymensingh', 'rajshahi', 'rangpur', 'sylhet'] as const;

export const BD_DISTRICTS_BY_DIVISION: Record<(typeof BD_DIVISIONS)[number], readonly string[]> = {
  barishal: ['barguna', 'barishal', 'bhola', 'jhalokati', 'patuakhali', 'pirojpur'],
  chattogram: ['bandarban', 'brahmanbaria', 'chandpur', 'chattogram', 'cumilla', 'coxs_bazar', 'feni', 'khagrachhari', 'lakshmipur', 'noakhali', 'rangamati'],
  dhaka: ['dhaka', 'faridpur', 'gazipur', 'gopalganj', 'kishoreganj', 'madaripur', 'manikganj', 'munshiganj', 'narayanganj', 'narsingdi', 'rajbari', 'shariatpur', 'tangail'],
  khulna: ['bagerhat', 'chuadanga', 'jashore', 'jhenaidah', 'khulna', 'kushtia', 'magura', 'meherpur', 'narail', 'satkhira'],
  mymensingh: ['jamalpur', 'mymensingh', 'netrokona', 'sherpur'],
  rajshahi: ['bogura', 'chapainawabganj', 'joypurhat', 'naogaon', 'natore', 'pabna', 'rajshahi', 'sirajganj'],
  rangpur: ['dinajpur', 'gaibandha', 'kurigram', 'lalmonirhat', 'nilphamari', 'panchagarh', 'rangpur', 'thakurgaon'],
  sylhet: ['habiganj', 'moulvibazar', 'sunamganj', 'sylhet'],
};

export const BD_DISTRICTS: readonly string[] = BD_DIVISIONS.flatMap((division) => BD_DISTRICTS_BY_DIVISION[division]);
