import { useDrafts } from '../state/drafts.tsx'

interface Props {
  subjectKind: 'pr' | 'local'
}

export const SubmitBar = ({ subjectKind }: Props) => {
  const {
    drafts,
    submitting,
    openConfirmReview,
    openConfirmDismiss,
  } = useDrafts()

  const total = drafts.length

  return (
    <div className="submit-bar">
      <span className="count" aria-live="polite">
        {total} draft{total === 1 ? '' : 's'}
      </span>
      <button
        type="button"
        className="dismiss"
        onClick={openConfirmDismiss}
        disabled={submitting}
      >
        Dismiss session
      </button>
      <button
        type="button"
        className={subjectKind === 'local' ? 'comment primary' : 'comment'}
        onClick={() => openConfirmReview('comment')}
        disabled={submitting}
      >
        {subjectKind === 'local' ? 'Finish review' : 'Comment'}
      </button>
      {subjectKind === 'pr' ? (
        <button
          type="button"
          className="approve primary"
          onClick={() => openConfirmReview('approve')}
          disabled={submitting}
        >
          Approve
        </button>
      ) : null}
    </div>
  )
}
