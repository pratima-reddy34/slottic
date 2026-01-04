
'use client';

import Head from 'next/head';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Added import for next/image
import { Button } from '@/components/ui/button';
// Removed Coffee import as it's not used here after logo change

// Styles object for new sections and footer
const styles: { [key: string]: React.CSSProperties } = {
  section: {
    padding: '2rem 1rem',
    textAlign: 'center' as 'center',
    width: '100%',
    maxWidth: '1300px',
    margin: '2rem auto',
    backgroundColor: 'rgba(0, 0, 0, 0.55)', // Slightly more opaque for content sections
    borderRadius: '12px',
    color: '#ffffff',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  heading: {
    fontSize: '2.25rem',
    marginBottom: '1.5rem',
    color: '#ffffff',
    fontWeight: 600,
  },
  paragraph: {
    fontSize: '1.1rem',
    lineHeight: '1.7',
    color: '#f0f0f0',
  },
  contactLink: {
    color: '#93c5fd',
    textDecoration: 'underline',
    marginLeft: '0.25rem',
  },
  footer: {
    padding: '1.5rem',
    textAlign: 'center' as 'center',
    fontSize: '0.9rem',
    color: '#d1d5db',
    width: '100%', // Ensure footer takes full width
  },
};

// Navbar
const Navbar = () => (
  <nav className="flex justify-between items-center h-19 md:h-23 px-4 md:px-6 bg-black/60 text-white sticky top-0 z-50 shadow-md overflow-visible">
    <Link
      href="/"
      className="flex items-center gap-2 text-xl md:text-2xl font-bold text-primary-foreground hover:opacity-90 transition-opacity relative"
    >
      <div className="relative -top-0 md:-top-0">
        <Image
          src="https://firebasestorage.googleapis.com/v0/b/cafe-connector-gicmg.firebasestorage.app/o/Slottic%20logo.png?alt=media&token=a58df2ff-c19b-49b4-9451-b07d333f5c15"
          alt="Slottic Logo"
          width={80}
          height={80}
          className="rounded-full object-cover h-18 w-18 md:h-22 md:w-22"
        />
      </div>
      
    </Link>
  </nav>
);



// Intro section
const Intro = () => (
  <section className="py-16 md:py-24 px-4 text-white text-center w-full max-w-3xl mx-auto">
    <div className="p-8 md:p-12 rounded-xl inline-block shadow-2xl bg-black/80">
      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
        style={{ fontFamily: '"Playfair Display", serif' }}
      >
        Welcome to Slottic
      </h1>
      <p className="text-lg md:text-xl lg:text-2xl text-slate-200">
        Your ultimate platform for discovering and booking unique slots and spaces.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
        <Button
          size="lg"
          asChild
          className="bg-primary text-primary-foreground text-lg px-8 py-3 transition-all duration-300 ease-in-out hover:bg-primary/80 hover:scale-105 hover:shadow-xl"
        >
          <Link href="/signup">Get Started</Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="border-white/70 text-white bg-white/10 text-lg px-8 py-3 transition-all duration-300 ease-in-out hover:bg-white/20 hover:scale-105 hover:shadow-xl"
        >
          <Link href="/login">I'm a Member</Link>
        </Button>
      </div>
    </div>
  </section>
);

// Main HomePage component
export default function HomePage() {
  return (
    <div
      className="min-h-screen text-white font-sans bg-fixed bg-slate-800 bg-hero flex flex-col relative"
      style={{
          backgroundImage: "url('/images/home-bg.png'')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
      }}
      data-ai-hint="modern city event space" // Changed hint for variety
    >
      {/* Background overlay for opacity */}
      <div className="absolute inset-0 bg-black/20 z-0"></div> {/* Opacity reduced here */}

      {/* Main content wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow flex flex-col items-center pt-8 pb-16 px-4">
          <Intro />

          <section style={styles.section}>
            <h2 style={styles.heading}>About Slottic</h2>
            <p style={styles.paragraph}>
            At Slottic, we believe in the power of connection, creativity, and effortless booking. Our platform 
            serves as a dynamic digital hub where café owners and event organizers come together to transform everyday 
            spaces into vibrant centers of activity.
              <br /><br />
              Whether it's for workshops, meetings, photoshoots, or pop-up events, Slottic empowers café managers to make the most of their unused
              time slots, while providing organizers with access to unique and welcoming venues.
              <br /><br />
              We’re on a mission to bridge the gap between available spaces and those who need them — fostering a thriving community that 
              supports local businesses and inspires memorable experiences through smart, streamlined bookings.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.heading}>Meet Our Team</h2>
            <p style={styles.paragraph}>
            We're a close-knit team of developers, designers, and forward-thinkers driven by a shared passion for building meaningful connections. At Slottic, we’re dedicated to making space booking simple, accessible, and impactful.
            <br /><br />
            Our mission is to support café owners in maximizing their potential and to empower organizers with the freedom to discover and book the perfect spot — All in just a few clicks.
            </p>
          </section>

          <section className="w-full max-w-7xl mx-auto mt-[5px] flex flex-col lg:flex-row gap-[7px]">
            <div className="flex-1 py-16 px-8 bg-black/50 rounded-xl shadow-lg text-white">
              <h2 className="text-4xl font-semibold mb-6 text-center">Cafe Managers</h2>
              <p className="text-lg leading-relaxed text-slate-100 text-justify">
              Unlock the full potential of your café with Slottic. Our platform offers a seamless, free way to list your venue and attract a diverse range of clients for workshops, meetings, pop-up shops, creative sessions, and more.
              <br /><br />
              Easily manage your availability, communicate with organizers, and showcase your space to a wider audience — all through an intuitive dashboard. With access to helpful tools and ongoing support, Slottic empowers you to turn unused time slots into valuable opportunities.
                
              </p>
            </div>

            <div className="flex-1 py-16 px-8 bg-black/50 rounded-xl shadow-lg text-white">
              <h2 className="text-4xl font-semibold mb-6 text-center">Event Organizers</h2>
              <p className="text-lg leading-relaxed text-slate-100 text-justify">
              Planning your next event has never been easier. Slottic connects you with inviting, budget-friendly venues that offer the perfect ambiance and amenities for your needs. Each listing includes key details like capacity, features, and high-quality photos to help you make confident decisions.
                <br /><br />
                Whether you're an artist, entrepreneur, instructor, or community leader, Slottic simplifies the process of finding and booking the ideal space. Promote, manage, and host your events — all from one convenient platform, without the usual hassle.
              </p>
            </div>
          </section>

          <section className="w-full max-w-7xl mx-auto py-16 px-8 bg-black/50 rounded-xl shadow-lg text-white mt-[5px]">
  <h2 className="text-4xl font-semibold mb-12 text-center">Pricing Plans</h2>
  <div className="flex flex-col lg:flex-row justify-center items-stretch gap-6 flex-wrap">
    {[
      {
        title: 'Slottic Start',
        price: '₹0 / first 7 days',
        features: [
          'Unlimited Requests for 7 Days',
          'Full Access to Listings',
          'No Credit Card Required'
        ]
      },
      {
        title: 'Slottic Basic',
        price: 'Free (Ongoing)',
        features: [
          '2 Requests per Week',
          'Access to Listings',
          'Upgrade Anytime'
        ]
      },
      {
        title: 'Slottic Plus',
        price: '₹200 / week',
        features: [
          'Unlimited Requests',
          'Access to All Listings',
          'Email Support',
          'Eligible for Featuring'
        ]
      },
      {
        title: 'Slottic Premium',
        price: '₹500 / month',
        features: [
          'Unlimited Requests',
          'Access to All Listings',
          'Priority Support',
          'Available for Featuring'
        ],
        badge: 'Most Popular'
      }
    ].map((plan, idx) => (
      <div
        key={idx}
        className={`
          relative flex-1 min-w-[280px] max-w-sm bg-black/80 border border-slate-700 rounded-xl p-6 shadow-md
          transition-transform duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl
          hover:border-primary hover:ring-2 hover:ring-primary/60
          ${plan.badge ? 'border-yellow-500 ring-2 ring-yellow-400' : ''}
        `}
      >
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow">
            {plan.badge}
          </div>
        )}
        <h3 className="text-2xl font-bold mb-2 text-center">{plan.title}</h3>
        <p className="text-xl text-green-400 mb-4 text-center">{plan.price}</p>
        <ul className="text-slate-200 list-disc pl-6 mb-4">
          {plan.features.map((feature, i) => (
            <li key={i} className="mb-1">{feature}</li>
          ))}
        </ul>
        <Button
          size="lg"
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-3 transition-all duration-300 ease-in-out hover:shadow-xl w-full mt-auto"
        >
          <Link href="/dashboard">Choose Plan</Link>
        </Button>
      </div>
    ))}
  </div>
</section>



          <section style={{ ...styles.section }}>
            <h2 style={styles.heading}>Contact Us</h2>
            <p style={styles.paragraph}>
            Have a question, suggestion, or just want to say hello?
            We’d love to hear from you!
            <br /><br />
            📩 Email: <a href="mailto:contact@slottic.com" style={styles.contactLink}> contact@slottic.com</a> 
            <br /><br />
            📷 Instagram: @slottic_official
            <br /><br />
            Our team is here to help you make the most of your Slottic experience — whether you're a café manager, event organizer, or curious visitor.
        
            </p>
          </section>
        </main>

        
      </div>
    </div>
  );
}
