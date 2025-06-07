const { getSortedServices, services } = require('../main');

describe('getSortedServices', () => {
  test('sorts services based on provided usage data', () => {
    const usage = { Netflix: 3, Hulu: 1, Prime: 2 };
    const sorted = getSortedServices(usage);
    expect(sorted[0]).toBe('Netflix');
    expect(sorted[1]).toBe('Prime');
    expect(sorted[2]).toBe('Hulu');
  });

  test('returns all available services', () => {
    const sorted = getSortedServices({});
    expect(sorted.length).toBe(Object.keys(services).length);
  });
});
