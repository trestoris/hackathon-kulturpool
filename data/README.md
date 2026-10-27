# Saved expert feedback

The local SvelteKit server reads and writes `data/reviews.json`. The JSON contains a
`version` (currently `1`) and a `reviews` object keyed by exact assessment ID. Each
review includes the decision, comment, search query, and entity/record snapshot.

The JSON file is the only source of saved feedback. Browser localStorage is not
read or imported. Other browsers using this same server see the file's reviews
on page load. Deleting the file (or emptying its `reviews` object) and reloading
leaves the sidebar empty. A missing file is created only when you save a new review.

Writes use a temporary file and atomic rename, with a directory lock to serialize
updates across processes. If the file is malformed, saves fail without replacing
it. Keep a copy of the JSON for backups. Stop the app before manually editing it.
If a server is forcibly terminated during a write, stop all app processes before
removing a leftover `reviews.json.lock` directory and restarting.

The JSON, temporary files and lock directory are excluded from Git. For tests or
another local instance, set `REVIEWS_FILE` to a different absolute file path.
Persistent storage requires a Node server with a writable, persistent filesystem;
this local demo endpoint does not provide user accounts or access control for a
public deployment.
