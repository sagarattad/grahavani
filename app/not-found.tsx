import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This link does not exist, or it was deleted.</p>
      <Link href="/" className="btn-primary mt-4">
        Go home
      </Link>
    </div>
  );
}
