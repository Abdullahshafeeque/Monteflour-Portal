'use client';

import { useState } from 'react';

export default function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `https://checkout.monteflour.com/checkout?utm_source=instagram&utm_medium=influencer&utm_campaign=${code}`;

  function handleCopy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn-secondary"
      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
}