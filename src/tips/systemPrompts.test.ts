import { isPrompting, subscribePrompting, whilePrompting } from './systemPrompts';

describe('whilePrompting', () => {
  it('holds the tips until the prompt is answered', async () => {
    const changes: boolean[] = [];
    const unsubscribe = subscribePrompting(() => changes.push(isPrompting()));
    let answer: (value: string) => void = () => undefined;

    const asked = whilePrompting(() => new Promise<string>((resolve) => (answer = resolve)));
    expect(isPrompting()).toBe(true);

    answer('granted');
    await expect(asked).resolves.toBe('granted');
    expect(isPrompting()).toBe(false);
    expect(changes).toEqual([true, false]);
    unsubscribe();
  });

  it('lets them go when the prompt fails too', async () => {
    await expect(whilePrompting(() => Promise.reject(new Error('denied')))).rejects.toThrow(
      'denied'
    );
    expect(isPrompting()).toBe(false);
  });
});
