// Configuration for Ranilo John (Shizuphrenia) Portfolio
const CONFIG = {
  profile: {
    name: "Ranilo John",
    alias: "Shizuphrenia",
    title: "Cybersecurity Analyst & Systems Architect",
    tagline: "Ruler of my own digital Latveria. Securing networks, writing clean code, and defending the digital perimeter with absolute authority.",
    email: "ranilojohn@example.com", // Replace with your actual email
    github: "RaniloJohn",
    discordId: "1092973630683619399", // REPLACE WITH YOUR DISCORD USER ID FOR LIVE SPOTIFY
  },
  
  // Categorized Skills
  skills: [
    {
      category: "Cybersecurity",
      icon: "shield-alert",
      description: "Threat monitoring, proactive defense, and incident analysis.",
      items: [
        { name: "Threat Detection", details: "Wazuh, Suricata" },
        { name: "SOC Operations", details: "Incident Analysis, Alerting" },
        { name: "Heuristic Analysis", details: "Behavioral anomaly detection" },
        { name: "Security Standards", details: "Compliance & frameworks" },
        { name: "Vulnerability Assessment", details: "Scanning & remediation" }
      ]
    },
    {
      category: "Programming",
      icon: "code",
      description: "Writing robust code and crafting clean web structures.",
      items: [
        { name: "Python", details: "Scripting, Automation, Security tools" },
        { name: "Java", details: "OOP development, Systems logic" },
        { name: "HTML & CSS", details: "Responsive layouts, premium UI design" }
      ]
    },
    {
      category: "Computer Networking",
      icon: "network-wired",
      description: "Configuring, routing, and analyzing complex network infrastructures.",
      items: [
        { name: "Cisco Routing & Switching", details: "VLANs, OSPF, VTP" },
        { name: "Subnetting & STP", details: "IP allocation, loop prevention" },
        { name: "Packet Analysis", details: "Wireshark, deep packet inspection" }
      ]
    },
    {
      category: "Systems & Tools",
      icon: "server",
      description: "Managing host environments, virtualization, and planning tools.",
      items: [
        { name: "Linux Administration", details: "Ubuntu, Kali Linux" },
        { name: "VMWare Workstation", details: "Hypervisor & VM labs" },
        { name: "GNS3", details: "Network virtualization & testing" },
        { name: "AutoCAD 3D Modeling", details: "Architectural & systems drafting" }
      ]
    }
  ],

  // Fallback tracks for the Spotify player when user is offline or has no Discord ID set
  spotifyFallback: [
    {
      title: "All Caps",
      artist: "Madvillain, MF DOOM",
      album: "Madvillainy",
      duration: "2:10",
      url: "https://open.spotify.com/track/2Z4O0vghxevRnuvTySpOI6",
      cover: "https://i.scdn.co/image/ab67616d0000b273b5df54db22dbfd06f4777590"
    },
    {
      title: "Rhinestone Cowboy",
      artist: "Madvillain, MF DOOM",
      album: "Madvillainy",
      duration: "3:59",
      url: "https://open.spotify.com/track/62gG1g7U081R56j9BvLw14",
      cover: "https://i.scdn.co/image/ab67616d0000b273b5df54db22dbfd06f4777590"
    },
    {
      title: "DOOM (Original Game Soundtrack)",
      artist: "Mick Gordon",
      album: "DOOM (OST)",
      duration: "4:57",
      url: "https://open.spotify.com/track/6tNZuCskm595m8K9f62N7S",
      cover: "https://i.scdn.co/image/ab67616d0000b2736b44a4eb9ab7988358172c72"
    }
  ]
};
