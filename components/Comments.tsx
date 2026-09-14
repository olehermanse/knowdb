import Timestamp from "@/components/Timestamp";
import { Comment, commentKey, EntryRef, getComments } from "@/lib/data";

// Comments on an entry: the example comments from data/comments.json plus,
// filled in by the layout's inline script, the ones the user wrote, which
// are kept in the browser's local storage. The form is handled by the same
// script; nothing is sent anywhere. Demo only.
export default function Comments({ entry, heading }: { entry: EntryRef; heading?: boolean }) {
  const list = getComments(entry);
  const key = commentKey(entry);
  // The parts the inline script changes (the count and the user's own
  // comments) are rendered with dangerouslySetInnerHTML and
  // suppressHydrationWarning: the script may already have filled them from
  // local storage by the time React hydrates, and React must neither patch
  // nor warn about that.
  const emptyRow = list.length === 0 ? EMPTY_ROW : "";
  return (
    <section className="comments" data-comments={key} data-testid="comments">
      {heading && (
        <h2 data-testid="comments-heading">
          Comments{" "}
          <span
            className="muted"
            data-comments-count
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: `(${list.length})` }}
          />
        </h2>
      )}
      <div data-testid="comments-list">
        <ul className="entry-list comments-list">
          {list.map((comment, i) => (
            <CommentCard key={i} comment={comment} />
          ))}
        </ul>
        <ul
          className="entry-list comments-list"
          data-local-comments
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: emptyRow }}
        />
      </div>
      <form className="comment-form" data-comment-form data-testid="comment-form">
        <label>
          <span className="muted">Comment</span>
          <textarea name="text" rows={3} required placeholder="Write a comment…" data-testid="comment-text" />
        </label>
        <div className="comment-form-actions">
          <button type="submit" className="list-modal-button" data-testid="comment-submit">
            Post comment
          </button>
          <span className="muted comment-form-note">
            Posted as Alice or Bob, stored in this browser only (demo).
          </span>
        </div>
      </form>
    </section>
  );
}

// Shown (by the server, or by the script) when there are no comments.
const EMPTY_ROW = '<li class="muted comments-empty" data-comments-empty>No comments yet.</li>';

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <li className="comment-card" data-testid="comment-card">
      <div className="comment-meta">
        <strong data-testid="comment-card-author">{comment.author}</strong>{" "}
        <span className="muted">
          <Timestamp iso={comment.time} />
        </span>
      </div>
      <p className="comment-body" data-testid="comment-card-text">
        {comment.text}
      </p>
    </li>
  );
}
