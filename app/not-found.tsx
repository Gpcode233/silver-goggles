import Link from "next/link";
import { Button } from "@/components/ui/button";
import notFoundImage from "@/assets/error-404-not-found.png";
import Image from 'next/image';

export default function NotFound() {
  return (
    <main className="mx-auto flex flex-col items-center justify-center">
      <Image
        src={notFoundImage}
        alt="404 Not Found"
        className="mx-auto mb-4 h-64 w-auto"
      />
      <h1 className="mx-auto mb-2 w-auto text-5xl font-black sm:text-6xl">Not Found</h1>
      <p className="muted mt-0 text-sm">Page not found. The URL may be incorrect, moved, or deleted. Please check and try again.</p>
      <Button variant="outline" className="mt-5 border-blue-950 border-dashed" asChild>
        <Link href="/">Back to Home</Link>
      </Button>
    </main>
  );
}
