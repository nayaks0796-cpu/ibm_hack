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
});
