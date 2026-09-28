import { describe, it, expect } from 'vitest';

import { isTravelEvent } from '../echoTravel.ts';
import type { WsEchoEvent } from '../../types/api.ts';

describe('isTravelEvent', () => {
  it('counts a completed travel between shards', () => {
    const event: WsEchoEvent = {
      type: 'ShardTravelCompleted',
      echo_id: 'echo-1',
      shard_id: 'shard-2',
    };
    expect(isTravelEvent(event)).toBe(true);
  });

  it('does not count a move inside a shard', () => {
    const event: WsEchoEvent = {
      type: 'EchoMoved',
      echo_id: 'echo-1',
      from_location: 'market',
      to_location: 'harbour',
    };
    expect(isTravelEvent(event)).toBe(false);
  });
});
