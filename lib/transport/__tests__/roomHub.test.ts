import { dropPresence, publish, pull, snapshotPeers } from "../roomHub";

describe("roomHub", () => {
  test("snapshot after publish shows the sender online without replaying backlog", async () => {
    const room = `hub-snap-${Date.now()}`;
    publish(room, "clerk", { type: "hello", role: "clerk" });

    const snap = await pull(room, "user", -1);
    expect(snap.peers.clerk).toBe(true);
    expect(snap.peers.user).toBe(true);
    expect(snap.messages).toEqual([]);
    expect(snap.cursor).toBeGreaterThan(0);
  });

  test("later pulls deliver messages from the other role only", async () => {
    const room = `hub-msgs-${Date.now()}`;
    publish(room, "clerk", { type: "hello", role: "clerk", n: 1 });
    const snap = await pull(room, "user", -1);

    publish(room, "user", { type: "hello", role: "user", n: 2 });
    publish(room, "clerk", { type: "presence", role: "clerk", n: 3 });

    const next = await pull(room, "user", snap.cursor);
    expect(next.messages).toEqual([{ type: "presence", role: "clerk", n: 3 }]);
  });

  test("bye drops presence for that role", async () => {
    const room = `hub-bye-${Date.now()}`;
    publish(room, "clerk", { type: "hello", role: "clerk" });
    expect(snapshotPeers(room).clerk).toBe(true);

    dropPresence(room, "clerk");
    expect(snapshotPeers(room).clerk).toBe(false);
  });
});
