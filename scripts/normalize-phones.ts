/**
 * Normalize phone numbers to consistent format: (XXX) XXX-XXXX
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { eq, and, isNotNull, ne } from 'drizzle-orm';

function normalizePhone(phone: string): string | null {
  // Extract digits
  const digits = phone.replace(/\D/g, '');

  // Handle 10-digit numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11-digit (1 + 10)
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  // Return null if can't normalize
  return null;
}

async function normalizePhones(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('PHONE NUMBER NORMALIZER');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const allServices = await db.select({
    serviceId: services.serviceId,
    phone: services.phone,
  })
  .from(services)
  .where(and(
    eq(services.isActive, true),
    isNotNull(services.phone),
    ne(services.phone, '')
  ));

  let updated = 0;
  for (const svc of allServices) {
    if (!svc.phone) continue;

    const normalized = normalizePhone(svc.phone);
    if (normalized && normalized !== svc.phone) {
      console.log(`${svc.phone} → ${normalized}`);
      updated++;

      if (!dryRun) {
        await db.update(services)
          .set({ phone: normalized })
          .where(eq(services.serviceId, svc.serviceId));
      }
    }
  }

  console.log(`\n${updated} phone numbers to normalize`);
  if (dryRun && updated > 0) {
    console.log(`Run with --execute to apply changes`);
  }

  process.exit(0);
}

const dryRun = !process.argv.includes('--execute');
normalizePhones(dryRun).catch(console.error);
