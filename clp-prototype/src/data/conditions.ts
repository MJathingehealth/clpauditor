export type ConditionKey = "back" | "knee" | "neck" | "general";

export interface ConditionData {
  key: ConditionKey;
  label: string;
  hero: {
    headline: string;
    subhead: string;
    ctaText: string;
    trustLine: string;
    image: string;
  };
  trustBar: {
    memberCount: string;
    primaryStat: string;
    rating: string;
  };
  howItWorks: {
    title: string;
    steps: { icon: string; title: string; description: string }[];
  };
  outcomes: {
    title: string;
    stats: { value: string; description: string }[];
    citation: string;
  };
  story: {
    title: string;
    quote: string;
    name: string;
    condition: string;
    image: string;
  };
  finalCta: {
    headline: string;
    ctaText: string;
    trustLine: string;
  };
}

export const CONDITIONS: Record<ConditionKey, ConditionData> = {
  back: {
    key: "back",
    label: "Back Pain",
    hero: {
      headline: "Get lasting relief from back pain",
      subhead:
        "A personal care team — physical therapy, coaching, and a wearable sensor — covered by your employer at $0 cost.",
      ctaText: "Start My Free Assessment",
      trustLine: "Takes 5 minutes · No commitment",
      image:
        "https://images.ctfassets.net/hjcv6wdwxsdz/1rgqQlW3YzzGtOi3TP6YaH/2de2a813e6b3eb4ed8b5d589d29ddb28/BackBasicHero.avif",
    },
    trustBar: {
      memberCount: "750K+ back pain members treated",
      primaryStat: "75% report significant pain reduction",
      rating: "4.8★ App Store rating",
    },
    howItWorks: {
      title: "How it works for your back",
      steps: [
        {
          icon: "📋",
          title: "Take a 5-min assessment",
          description: "Tell us about your back pain and goals",
        },
        {
          icon: "👩‍⚕️",
          title: "Get your care plan",
          description:
            "A physical therapist builds your personalized back program",
        },
        {
          icon: "📱",
          title: "Start feeling better",
          description:
            "Exercise therapy + a wearable sensor that guides your movement",
        },
      ],
    },
    outcomes: {
      title: "Back pain results from real members",
      stats: [
        {
          value: "75%",
          description:
            "report clinically significant back pain reduction within 12 weeks",
        },
        {
          value: "68%",
          description: "reduction in back surgery recommendations",
        },
      ],
      citation:
        "Based on peer-reviewed clinical studies published in JAMA and BMC Musculoskeletal Disorders",
    },
    story: {
      title: "Sarah's back pain story",
      quote:
        "I was considering surgery for my herniated disc. After 8 weeks with Hinge Health, my pain dropped from an 8 to a 2. I canceled the surgery.",
      name: "Sarah M.",
      condition: "Herniated disc · L4-L5",
      image:
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=face",
    },
    finalCta: {
      headline: "Ready to fix your back pain?",
      ctaText: "Start My Free Assessment",
      trustLine: "Join 750,000+ members who found relief",
    },
  },

  knee: {
    key: "knee",
    label: "Knee Pain",
    hero: {
      headline: "Move freely again — without knee surgery",
      subhead:
        "Personalized physical therapy for your knees, guided by a clinical care team and wearable motion sensor. $0 with your employer benefits.",
      ctaText: "Start My Free Assessment",
      trustLine: "Takes 5 minutes · No commitment",
      image:
        "https://images.ctfassets.net/hjcv6wdwxsdz/7MIJqVrbjQs6MUTLPdu0bw/59f94fe45238bbd658494dc993a867b6/KneeBasicHero.avif",
    },
    trustBar: {
      memberCount: "500K+ knee pain members treated",
      primaryStat: "68% reduction in knee surgery recs",
      rating: "4.8★ App Store rating",
    },
    howItWorks: {
      title: "How it works for your knees",
      steps: [
        {
          icon: "📋",
          title: "Take a 5-min assessment",
          description: "Tell us about your knee pain and what you want to get back to",
        },
        {
          icon: "👩‍⚕️",
          title: "Get your care plan",
          description:
            "A physical therapist designs exercises specific to your knee condition",
        },
        {
          icon: "📱",
          title: "Start moving again",
          description:
            "Guided exercises + a sensor that tracks your knee range of motion",
        },
      ],
    },
    outcomes: {
      title: "Knee pain results from real members",
      stats: [
        {
          value: "68%",
          description: "reduction in knee surgery recommendations",
        },
        {
          value: "72%",
          description:
            "report significant improvement in knee function within 12 weeks",
        },
      ],
      citation:
        "Based on peer-reviewed clinical studies published in JAMA and Journal of Medical Internet Research",
    },
    story: {
      title: "Marcus's knee pain story",
      quote:
        "My doctor said I'd need a knee replacement within 2 years. Hinge Health gave me a program that got me back to hiking. That was 18 months ago — still no surgery.",
      name: "Marcus T.",
      condition: "Knee osteoarthritis · Grade III",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    },
    finalCta: {
      headline: "Ready to move without knee pain?",
      ctaText: "Start My Free Assessment",
      trustLine: "Join 500,000+ members who got moving again",
    },
  },

  neck: {
    key: "neck",
    label: "Neck & Shoulder",
    hero: {
      headline: "End chronic neck pain — for good",
      subhead:
        "A clinical care team that treats neck and shoulder pain with guided exercise therapy, one-on-one coaching, and a wearable sensor. Covered by your employer.",
      ctaText: "Start My Free Assessment",
      trustLine: "Takes 5 minutes · No commitment",
      image:
        "https://images.ctfassets.net/hjcv6wdwxsdz/1RK6BS5cewPMFkQJ9jQMPP/f24f0a7c108b9bf8d9b3427dc6d15faf/NeckBasicHero.avif",
    },
    trustBar: {
      memberCount: "300K+ neck pain members treated",
      primaryStat: "71% pain reduction in 12 weeks",
      rating: "4.8★ App Store rating",
    },
    howItWorks: {
      title: "How it works for your neck",
      steps: [
        {
          icon: "📋",
          title: "Take a 5-min assessment",
          description:
            "Tell us about your neck or shoulder pain and daily habits",
        },
        {
          icon: "👩‍⚕️",
          title: "Get your care plan",
          description:
            "A physical therapist creates a program for your neck and posture",
        },
        {
          icon: "📱",
          title: "Feel the difference",
          description:
            "Desk-friendly exercises + a sensor that corrects your posture in real time",
        },
      ],
    },
    outcomes: {
      title: "Neck pain results from real members",
      stats: [
        {
          value: "71%",
          description:
            "report clinically significant neck pain reduction within 12 weeks",
        },
        {
          value: "58%",
          description: "fewer visits to specialists for neck and shoulder pain",
        },
      ],
      citation:
        "Based on peer-reviewed studies published in BMC Musculoskeletal Disorders",
    },
    story: {
      title: "Priya's neck pain story",
      quote:
        "Years of desk work destroyed my neck. I'd tried chiropractors, massage, cortisone shots — nothing lasted. Hinge Health gave me exercises I could do between meetings. Within 6 weeks, the constant ache was gone.",
      name: "Priya K.",
      condition: "Cervical disc degeneration · C5-C6",
      image:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face",
    },
    finalCta: {
      headline: "Ready to end your neck pain?",
      ctaText: "Start My Free Assessment",
      trustLine: "Join 300,000+ members living pain-free",
    },
  },

  general: {
    key: "general",
    label: "General MSK",
    hero: {
      headline: "Your whole body, one care team",
      subhead:
        "Hinge Health treats back, knee, hip, neck, and shoulder pain with a personal clinical team, guided exercises, and a wearable motion sensor. $0 with your benefits.",
      ctaText: "Start My Free Assessment",
      trustLine: "Takes 5 minutes · No commitment",
      image:
        "https://images.ctfassets.net/hjcv6wdwxsdz/1LqCcQNwzhh2T5ckEDQKvU/91a057927f748d5083b254852af7b91c/MixBasicHero.avif",
    },
    trustBar: {
      memberCount: "1.5M+ members treated",
      primaryStat: "2.4x more likely to complete treatment",
      rating: "4.8★ App Store rating",
    },
    howItWorks: {
      title: "How Hinge Health works",
      steps: [
        {
          icon: "📋",
          title: "Take a 5-min assessment",
          description: "Tell us where it hurts and what your goals are",
        },
        {
          icon: "👩‍⚕️",
          title: "Get matched with your care team",
          description:
            "A physical therapist and health coach build your personalized plan",
        },
        {
          icon: "📱",
          title: "Start your program",
          description:
            "Exercise therapy + a wearable sensor — all from your phone",
        },
      ],
    },
    outcomes: {
      title: "Outcomes from real members",
      stats: [
        {
          value: "2.4x",
          description: "more likely to complete treatment vs. in-person PT",
        },
        {
          value: "69%",
          description: "average pain reduction across all conditions",
        },
      ],
      citation:
        "Based on peer-reviewed clinical studies published in JAMA, BMC, and JMIR",
    },
    story: {
      title: "David's story",
      quote:
        "Between my back and my shoulder, I was popping ibuprofen all day. Hinge Health gave me one program that addressed both. Three months later, I'm pain-free and off the meds.",
      name: "David R.",
      condition: "Lower back + rotator cuff",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    },
    finalCta: {
      headline: "Ready to live without pain?",
      ctaText: "Start My Free Assessment",
      trustLine: "Join 1.5 million members who found relief",
    },
  },
};

export const CONDITION_ORDER: ConditionKey[] = [
  "back",
  "knee",
  "neck",
  "general",
];
