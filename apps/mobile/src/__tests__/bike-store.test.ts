import { useBikeStore } from '../stores/bike.store';

beforeEach(() => {
  useBikeStore.setState({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,
    lastHeartbeatAck: null,
    commandHistory: [],
  });
});

describe('lastHeartbeatAck', () => {
  test('initial value is null', () => {
    expect(useBikeStore.getState().lastHeartbeatAck).toBeNull();
  });

  test('recordHeartbeatAck() sets a timestamp (simulates 0xEC dispatch)', () => {
    const before = Date.now();
    useBikeStore.getState().recordHeartbeatAck();
    const ack = useBikeStore.getState().lastHeartbeatAck;
    expect(ack).not.toBeNull();
    expect(ack!).toBeGreaterThanOrEqual(before);
  });

  test('calling again updates the timestamp (simulates 0xE7 dispatch)', () => {
    useBikeStore.getState().recordHeartbeatAck();
    const first = useBikeStore.getState().lastHeartbeatAck!;
    useBikeStore.getState().recordHeartbeatAck();
    expect(useBikeStore.getState().lastHeartbeatAck!).toBeGreaterThanOrEqual(first);
  });
});

describe('commandHistory', () => {
  test('empty on init', () => {
    expect(useBikeStore.getState().commandHistory).toHaveLength(0);
  });

  test('recordCommandSent adds entry with correct code, sentAt, ackedAt=null', () => {
    const before = Date.now();
    useBikeStore.getState().recordCommandSent(0x67);
    const [entry] = useBikeStore.getState().commandHistory;
    expect(entry!.code).toBe(0x67);
    expect(entry!.sentAt).toBeGreaterThanOrEqual(before);
    expect(entry!.ackedAt).toBeNull();
  });

  test('recordCommandAcked sets ackedAt on the most recent unacked matching entry', () => {
    useBikeStore.getState().recordCommandSent(0x67);
    useBikeStore.getState().recordCommandAcked(0x67);
    const [entry] = useBikeStore.getState().commandHistory;
    expect(entry!.ackedAt).not.toBeNull();
    expect(entry!.ackedAt!).toBeGreaterThanOrEqual(entry!.sentAt);
  });

  test('FIFO: 21 inserts keeps at most 20 entries, oldest evicted', () => {
    for (let i = 0; i < 21; i++) {
      useBikeStore.getState().recordCommandSent(i);
    }
    const history = useBikeStore.getState().commandHistory;
    expect(history).toHaveLength(20);
    // code=0 was the first pushed and should be gone
    expect(history[0]!.code).toBe(1);
    expect(history[19]!.code).toBe(20);
  });

  test('recordCommandAcked does not affect already-acked entries', () => {
    useBikeStore.getState().recordCommandSent(0x67);
    useBikeStore.getState().recordCommandAcked(0x67);
    const firstAck = useBikeStore.getState().commandHistory[0]!.ackedAt;
    // Call again — no unacked entry with that code remains
    useBikeStore.getState().recordCommandAcked(0x67);
    expect(useBikeStore.getState().commandHistory[0]!.ackedAt).toBe(firstAck);
  });

  test('recordCommandAcked targets the most recent unacked entry when duplicates exist', () => {
    useBikeStore.getState().recordCommandSent(0x67); // entry 0
    useBikeStore.getState().recordCommandSent(0x67); // entry 1
    useBikeStore.getState().recordCommandAcked(0x67); // should ack entry 1 (most recent)
    const history = useBikeStore.getState().commandHistory;
    expect(history[0]!.ackedAt).toBeNull();   // entry 0 still unacked
    expect(history[1]!.ackedAt).not.toBeNull(); // entry 1 acked
  });
});
