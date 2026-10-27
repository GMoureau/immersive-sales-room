//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// WebGL does not exist in jsdom; the 3D world itself is checked in the browser.
vi.mock('./Wereld', () => ({
  Wereld: ({ domeinen, zaal }: { domeinen: { naam: string; status: string }[]; zaal: { boom: { stuks: number } } }) => (
    <ul>
      {domeinen.map((d) => (
        <li key={d.naam}>{`${d.naam}: ${d.status}`}</li>
      ))}
      <li>{`Boom: ${zaal.boom.stuks}`}</li>
    </ul>
  ),
}));

import App from '@/App';
import { voorbeeldBron } from '@/data/bron';

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App bron={voorbeeldBron} />)).not.toThrow();
  });

  it('starts in the lobby with the model status on the Verkoop door', async () => {
    render(<App bron={voorbeeldBron} />);
    expect(await screen.findByText('Verkoop: oranje')).toBeInTheDocument();
    expect(screen.getByText('HR: binnenkort')).toBeInTheDocument();
  });

  it('loads the sales room from the sample data', async () => {
    render(<App bron={voorbeeldBron} />);
    expect(await screen.findByText(/^Boom: \d+/)).toBeInTheDocument();
  });
});
