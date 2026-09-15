import { CallRoom, type CallRoomMessage } from "../CallRoom";

describe("CallRoom", () => {
  test("instantiates with default and custom roles", () => {
    const userRoom = new CallRoom("test-room", "user");
    expect(userRoom.role).toBe("user");
    expect(userRoom.roomId).toBe("test-room");
    userRoom.disconnect();

    const clerkRoom = new CallRoom("test-room", "clerk");
    expect(clerkRoom.role).toBe("clerk");
    expect(clerkRoom.roomId).toBe("test-room");
    clerkRoom.disconnect();
  });

  test("subscribes and unsubscribes message listeners", () => {
    const room = new CallRoom("test-room-sub", "user");
    const received: CallRoomMessage[] = [];
    const unsubscribe = room.onMessage((msg) => {
      received.push(msg);
    });

    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    room.disconnect();
  });

  test("deduplicates messages with the same msgId", () => {
    const room = new CallRoom("test-room-dedup", "user");
    const received: CallRoomMessage[] = [];
    room.onMessage((msg) => {
      received.push(msg);
    });

    room.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" });
    room.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" });
    room.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" });
    room.emit({ type: "user-tts", text: "Second", msgId: "unique-2" });

    expect(received.length).toBe(2);
    expect(received[0].type).toBe("user-tts");
    expect((received[0] as { text: string }).text).toBe("Hello");
    expect((received[1] as { text: string }).text).toBe("Second");
    room.disconnect();
  });

  test("marks the other role online on hello and offline on bye", () => {
    const room = new CallRoom("test-room-hello", "user");
    const states: boolean[] = [];
    room.onPeerChange((connected) => states.push(connected));

    room.emit({ type: "hello", role: "clerk", msgId: "hello-clerk-1" });
    expect(room.isPeerConnected).toBe(true);

    room.emit({ type: "bye", role: "clerk", msgId: "bye-clerk-1" });
    expect(room.isPeerConnected).toBe(false);
    expect(states).toEqual([false, true, false]);
    room.disconnect();
  });

  test("does not treat a same-role hello as the peer", () => {
    const room = new CallRoom("test-room-self", "user");
    room.emit({ type: "hello", role: "user", msgId: "hello-self" });
    expect(room.isPeerConnected).toBe(false);
    room.disconnect();
  });

  test("ignores room-joined while alone", () => {
    const room = new CallRoom("test-room-alone", "user");
    room.emit({
      type: "room-joined",
      roomId: "test-room-alone",
      role: "user",
      clientCount: 1,
      msgId: "joined-alone",
    });
    expect(room.isPeerConnected).toBe(false);
    room.disconnect();
  });

  test("treats peer-joined from the other role as online", () => {
    const room = new CallRoom("test-room-pj", "user");
    room.emit({
      type: "peer-joined",
      role: "clerk",
      clientCount: 2,
      msgId: "pj1",
    });
    expect(room.isPeerConnected).toBe(true);
    room.disconnect();
  });
});
