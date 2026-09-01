'use client';

import { useState, useTransition } from 'react';
import { deleteInfluencer } from '../actions';

export default function DeleteInfluencerButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
        <span style={{ color: '#c0392b' }}>Delete {name}?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteInfluencer(id);
              setConfirming(false);
            })
          }
          className="btn-submit"
          style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', background: '#c0392b' }}
        >
          {isPending ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="btn-secondary"
      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#c0392b' }}
    >
      Delete
    </button>
  );
}
