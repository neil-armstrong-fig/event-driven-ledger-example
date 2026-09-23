import {eventually} from "./Eventually";

const FAST = {timeoutMs: 200, intervalMs: 1};

it("resolves with the first defined value the poll returns", async () => {
  const poll = vi.fn<() => Promise<string | undefined>>().mockResolvedValue("found");

  await expect(eventually(poll, FAST)).resolves.toBe("found");
  expect(poll).toHaveBeenCalledTimes(1);
});

it("keeps polling while the poll returns undefined", async () => {
  const poll = vi
    .fn<() => Promise<string | undefined>>()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValue("finally");

  await expect(eventually(poll, FAST)).resolves.toBe("finally");
  expect(poll).toHaveBeenCalledTimes(3);
});

it("treats a falsy-but-defined value as found", async () => {
  const poll = vi.fn<() => Promise<number | undefined>>().mockResolvedValue(0);

  await expect(eventually(poll, FAST)).resolves.toBe(0);
});

it("keeps polling when the poll throws, so a not-yet-ready resource is not fatal", async () => {
  const poll = vi
    .fn<() => Promise<string | undefined>>()
    .mockRejectedValueOnce(new Error("table not ready"))
    .mockResolvedValue("ready");

  await expect(eventually(poll, FAST)).resolves.toBe("ready");
});

it("rejects at the timeout, naming the last thing the poll threw", async () => {
  const poll = vi.fn<() => Promise<string | undefined>>().mockRejectedValue(new Error("connection refused"));

  await expect(eventually(poll, {timeoutMs: 20, intervalMs: 1})).rejects.toThrow(/connection refused/);
});

it("rejects at the timeout, saying nothing was found, when the poll only ever returned undefined", async () => {
  const poll = vi.fn<() => Promise<string | undefined>>().mockResolvedValue(undefined);

  await expect(eventually(poll, {timeoutMs: 20, intervalMs: 1})).rejects.toThrow(/20ms/);
});
