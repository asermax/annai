import { useDrafts } from '../state/drafts.tsx'

export const PRLevelComment = () => {
  const { prBody, setPrBody } = useDrafts()

  return (
    <section className="pr-level-comment">
      <header className="section-head">
        <h2>Overall review comment (PR-level)</h2>
        <p className="hint">Optional. Shows at the top of your review on GitHub.</p>
      </header>
      <textarea
        value={prBody}
        onChange={e => setPrBody(e.target.value)}
        placeholder="Summarise your review here…"
        rows={4}
      />
    </section>
  )
}
