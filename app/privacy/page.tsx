import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - Baby Monitor",
  description: "Privacy policy for babymonitor.online",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen flex flex-col p-6">
      <header className="flex items-center gap-4 mb-8 max-w-2xl mx-auto w-full">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground">
          Privacy Policy
        </h1>
      </header>

      <article className="max-w-2xl mx-auto w-full prose prose-sm dark:prose-invert">
        <p className="text-sm text-muted-foreground">
          Last updated: April 10, 2026
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Overview</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Baby Monitor (<strong>babymonitor.online</strong>) is a privacy-first
          audio monitoring application. We are committed to protecting your
          privacy. This policy explains what data we collect, how we use it, and
          your rights.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Data We Do NOT Collect
        </h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>Audio data</strong> — Audio streams directly between your
            devices using WebRTC peer-to-peer encryption. No audio ever passes
            through or is stored on our servers.
          </li>
          <li>
            <strong>User accounts</strong> — We do not require registration,
            login, or any personal information to use the service.
          </li>
          <li>
            <strong>Cookies for tracking</strong> — We do not use tracking
            cookies, advertising cookies, or third-party analytics cookies.
          </li>
          <li>
            <strong>Location data</strong> — We do not collect or store your
            geographic location.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Data We Do Collect
        </h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>Signaling data (temporary)</strong> — To establish peer-to-peer
            connections, we temporarily store WebRTC signaling information
            (connection offers, answers, and ICE candidates) on our server. This
            data is automatically deleted after 30 minutes and contains no audio
            content.
          </li>
          <li>
            <strong>IP addresses (temporary)</strong> — When a receiver requests
            to connect, their IP address is shown to the sender for
            identification purposes. This is stored only as part of the
            temporary signaling data and is deleted when the session expires.
          </li>
          <li>
            <strong>Device type (temporary)</strong> — A general device
            identifier (e.g., &quot;iPhone&quot;, &quot;Android&quot;) derived
            from the browser&apos;s user agent string, used to help the sender
            identify connection requests.
          </li>
          <li>
            <strong>localStorage</strong> — We store a random listener ID in
            your browser&apos;s localStorage to enable reconnection to the same
            session. This data never leaves your device.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          How Audio Works
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Audio is transmitted using WebRTC (Web Real-Time Communication), an
          industry-standard protocol that creates a direct, encrypted connection
          between two devices. The audio stream is encrypted end-to-end using
          DTLS-SRTP and never passes through our servers. We have no ability to
          intercept, record, or listen to your audio.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Third-Party Services</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>Vercel</strong> — Hosting and serverless functions. Subject
            to{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Vercel&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Upstash Redis</strong> — Temporary signaling data storage.
            Subject to{" "}
            <a
              href="https://upstash.com/trust/privacy.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Upstash&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Google STUN servers</strong> — Used to help establish
            peer-to-peer connections through network address translation (NAT).
            These servers only assist with connection setup and do not relay
            audio.
          </li>
          <li>
            <strong>Cloudflare Web Analytics</strong> — Privacy-first, cookieless
            website analytics. Does not track individual users, does not use
            cookies, does not collect personal data, and does not cross-reference
            data across sites. Collects only aggregate page view metrics. Subject
            to{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Cloudflare&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Vercel Analytics</strong> — Privacy-friendly, cookieless
            web analytics. Does not track individual users or collect personal
            data. Subject to{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Vercel&apos;s Privacy Policy
            </a>
            .
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Cookies &amp; Consent
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This website does not use cookies. Our analytics providers (Cloudflare
          Web Analytics and Vercel Analytics) are both cookieless and do not
          require consent banners under GDPR, ePrivacy Directive, or similar
          regulations. No cookie consent banner is needed or shown because no
          cookies are set.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          GDPR Compliance (EU Users)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          We comply with the General Data Protection Regulation (GDPR). Under
          GDPR, you have the following rights:
        </p>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>
            <strong>Right to access</strong> — You can request information about
            any data we hold. Since we store only temporary signaling data that
            auto-deletes, there is typically no persistent data to access.
          </li>
          <li>
            <strong>Right to erasure</strong> — Signaling data is automatically
            deleted after 30 minutes. You can also clear your localStorage data
            through your browser settings at any time.
          </li>
          <li>
            <strong>Right to restriction</strong> — You can stop using the
            service at any time. No persistent data is retained.
          </li>
          <li>
            <strong>Data portability</strong> — No persistent personal data is
            stored that would need to be ported.
          </li>
          <li>
            <strong>Legal basis for processing</strong> — We process the minimal
            signaling data necessary to provide the service (legitimate
            interest). No consent is needed for cookies as we do not use tracking
            cookies.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          CCPA Compliance (California Users)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We do not sell personal information. We do not share personal
          information for cross-context behavioral advertising. The minimal
          temporary data we process is solely for providing the service.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Children&apos;s Privacy
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This service is designed for parents and caregivers to monitor
          children. We do not knowingly collect any personal information from
          children. The service does not require any user to provide personal
          information.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Data Security</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Audio is encrypted end-to-end via WebRTC (DTLS-SRTP)</li>
          <li>Signaling data is encrypted in transit (HTTPS/TLS)</li>
          <li>Sessions require explicit sender approval</li>
          <li>Sessions are locked after first approval — no unauthorized listeners</li>
          <li>All temporary data auto-expires</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">
          Changes to This Policy
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We may update this privacy policy from time to time. Changes will be
          posted on this page with an updated revision date.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Contact</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For privacy-related questions or concerns, please open an issue on our{" "}
          <a
            href="https://github.com/rabin-a/baby-monitor-web-app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GitHub repository
          </a>
          .
        </p>
      </article>
    </main>
  );
}
