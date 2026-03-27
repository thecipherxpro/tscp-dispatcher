import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Truck, Shield, Clock, Search, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import medxpressLogoDark from '@/assets/logo-dark.png';
import medxpressLogoLight from '@/assets/logo-light.png';

const features = [
  { icon: Truck, title: 'Real-Time Tracking', description: 'Follow your delivery every step of the way with live status updates.' },
  { icon: Shield, title: 'Secure & Confidential', description: 'Your health information is protected with industry-leading privacy standards.' },
  { icon: Clock, title: 'Fast Delivery', description: 'Same-day and next-day delivery options available across service areas.' },
  { icon: MapPin, title: 'Door-to-Door Service', description: 'Professional drivers deliver directly to your specified address.' },
];

const steps = [
  { step: '01', title: 'Order Placed', description: 'Your pharmacy processes and prepares your prescription.' },
  { step: '02', title: 'Picked Up', description: 'A verified driver picks up your package securely.' },
  { step: '03', title: 'In Transit', description: 'Track your delivery in real-time as it heads your way.' },
  { step: '04', title: 'Delivered', description: 'Receive your prescription at your doorstep.' },
];

export default function LandingPage() {
  const [trackingInput, setTrackingInput] = useState('');
  const navigate = useNavigate();

  const handleTrack = () => {
    const id = trackingInput.trim();
    if (id) navigate(`/track/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={medxpressLogoDark} alt="KitKin Express" className="h-14 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/TrackShipment">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Track Order</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Sign In</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Shield className="w-4 h-4" />
              Trusted Pharmacy Delivery
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
              Your Prescriptions,{' '}<span className="text-primary">Delivered Safely</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              KitKin Express provides secure, confidential prescription delivery right to your door. Track your order in real-time with complete peace of mind.
            </p>
            <div className="max-w-md mx-auto">
              <div className="flex gap-2 p-2 rounded-xl bg-card border border-border shadow-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Enter tracking ID..." value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTrack()} className="pl-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <Button onClick={handleTrack} className="bg-primary text-primary-foreground hover:bg-primary/90 px-6">
                  Track <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Enter your tracking ID to see live delivery status</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Why Choose KitKin Express</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">Professional, secure, and reliable prescription delivery you can trust.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="group p-6 rounded-2xl bg-background border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">How It Works</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">From pharmacy to your doorstep — simple, secure, and transparent.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                {index < steps.length - 1 && <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />}
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl">{item.step}</div>
                  <h3 className="font-semibold text-foreground text-lg">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground tracking-tight">Ready to Track Your Delivery?</h2>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">Enter your tracking ID to get real-time updates on your prescription delivery.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/TrackShipment">
              <Button size="lg" variant="secondary" className="text-base px-8"><Package className="w-5 h-5 mr-2" />Track Your Order</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Driver Portal</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={medxpressLogoDark} alt="MedXpress" className="h-10 w-auto" />
              <span className="font-bold text-foreground italic -rotate-1">MedXpress</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/TrackShipment" className="hover:text-foreground transition-colors">Track Order</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} MedXpress. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
