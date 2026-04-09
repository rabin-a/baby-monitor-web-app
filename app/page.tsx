import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Baby, Headphones, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Baby className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Baby Monitor
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs text-balance">
            Privacy-first audio monitoring. No accounts, no tracking, just
            secure peer-to-peer audio.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
          <Link href="/sender" className="w-full">
            <Button
              size="lg"
              className="w-full h-20 text-lg rounded-2xl gap-3 bg-primary hover:bg-primary/90"
            >
              <Baby className="w-6 h-6" />
              Start as Baby (Sender)
            </Button>
          </Link>

          <Link href="/receiver" className="w-full">
            <Button
              size="lg"
              variant="secondary"
              className="w-full h-20 text-lg rounded-2xl gap-3"
            >
              <Headphones className="w-6 h-6" />
              Listen as Parent (Receiver)
            </Button>
          </Link>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
          <Shield className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Audio streams directly between devices using WebRTC. No data is
            stored on any server. Sessions expire automatically after 2 minutes
            of inactivity.
          </p>
        </div>
      </div>
    </main>
  );
}
