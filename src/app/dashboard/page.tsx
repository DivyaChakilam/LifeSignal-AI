import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SOSButton } from "@/components/sos-button";
import { ManualCheckIn } from "@/components/manual-checkin";
import { IntervalSetting } from "@/components/interval-setting";
import { StatusCard } from "@/components/status-card";
import { EmergencyContacts } from "@/components/emergency-contacts";
import { VoiceCheckIn } from "@/components/voice-check-in";

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-headline font-bold mb-6">
          Your Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Main Features */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* SOS Button */}
            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Send SOS Alert</h2>
              <p className="text-sm text-gray-500 mb-2">
                Press the button if you are in danger.
              </p>
              <SOSButton />
            </div>

            {/* Manual Check-in */}
            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Manual Check-in</h2>
              <p className="text-sm text-gray-500 mb-2">
                Confirm you’re safe with a single tap.
              </p>
              <ManualCheckIn />
            </div>

            {/* Interval Setting */}
            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Check-in Interval</h2>
              <p className="text-sm text-gray-500 mb-2">
                How often should we remind you to check in?
              </p>
              <IntervalSetting />
            </div>

            {/* Status */}
            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Status</h2>
              <p className="text-sm text-gray-500 mb-2">
                Your latest activity updates.
              </p>
              <StatusCard />
            </div>

            {/* Emergency Contacts */}
            <div className="md:col-span-2 p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Emergency Contacts</h2>
              <p className="text-sm text-gray-500 mb-2">
                Your designated points of contact.
              </p>
              <EmergencyContacts />
            </div>
          </div>

          {/* Right Side - Voice Check-in */}
          <div className="lg:col-span-1 p-4 bg-white rounded-2xl shadow">
            <h2 className="text-lg font-semibold">Voice Check-in</h2>
            <p className="text-sm text-gray-500 mb-2">
              Press the button and say "I’m OK" to check in.
            </p>
            <VoiceCheckIn />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
