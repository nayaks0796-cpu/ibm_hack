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

    // Access private emit via prototype or method call
    const anyRoom = room as unknown as { emit: (msg: CallRoomMessage) => void };
    anyRoom.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" });
    anyRoom.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" }); // duplicate
    anyRoom.emit({ type: "user-tts", text: "Hello", msgId: "unique-1" }); // triplicate
    anyRoom.emit({ type: "user-tts", text: "Second", msgId: "unique-2" });

    expect(received.length).toBe(2);
    expect(received[0].type).toBe("user-tts");
    expect((received[0] as { text: string }).text).toBe("Hello");
    expect((received[1] as { text: string }).text).toBe("Second");
    room.disconnect();
  });
});
