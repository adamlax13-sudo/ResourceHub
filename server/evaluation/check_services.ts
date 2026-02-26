import 'dotenv/config';
import { storage } from '../storage';

async function checkServices() {
  const services = await storage.getAllActiveServices();

  const categories = [
    { name: 'Postpartum/Perinatal', patterns: ['postpartum', 'perinatal', 'maternal mental', 'new mom', 'ppd'] },
    { name: 'Pregnancy Loss/Miscarriage', patterns: ['miscarriage', 'stillbirth', 'pregnancy loss', 'perinatal loss'] },
    { name: 'Pet Grief', patterns: ['pet loss', 'pet grief', 'animal loss', 'pet bereavement'] },
    { name: 'ADHD', patterns: ['adhd', 'add ', 'attention deficit'] },
    { name: 'Credit/Debt Counselling', patterns: ['credit', 'debt', 'financial counsel', 'money management'] },
    { name: 'Childcare Subsidy', patterns: ['childcare subsid', 'daycare subsid', 'daycare assist', 'child care cost'] },
    { name: 'Tenant/Eviction Legal', patterns: ['tenant', 'eviction', 'landlord', 'renter'] },
    { name: 'Caregiver Support', patterns: ['caregiver', 'caregiving'] },
    { name: 'LGBTQ Senior', patterns: ['lgbtq senior', 'lgbt senior', 'queer senior', 'older adult lgbtq'] },
    { name: 'Family Addiction (Al-Anon style)', patterns: ['al-anon', 'alanon', 'family support.*addict', 'loved one.*addict', 'family member.*substance'] },
    { name: 'Veteran Services', patterns: ['veteran', 'military', 'osi-can', 'armed forces'] },
  ];

  for (const cat of categories) {
    console.log(`\n=== ${cat.name.toUpperCase()} ===`);
    const matches = services.filter(s => {
      const text = (s.name + ' ' + (s.description || '')).toLowerCase();
      return cat.patterns.some(p => text.includes(p));
    });
    if (matches.length === 0) {
      console.log('NO MATCHES FOUND');
    } else {
      matches.slice(0, 5).forEach(s => {
        const desc = (s.description || '').slice(0, 120);
        console.log(`- ${s.name}: ${desc}...`);
      });
      if (matches.length > 5) console.log(`  ... and ${matches.length - 5} more`);
    }
  }
  process.exit(0);
}

checkServices();
