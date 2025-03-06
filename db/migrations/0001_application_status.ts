import { sql } from "drizzle-orm";

export async function up(db: any) {
  // First drop the existing enum type and constraints
  await db.execute(sql`
    ALTER TABLE job_applications 
    ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE job_applications 
    ALTER COLUMN status TYPE TEXT;
    
    DROP TYPE IF EXISTS application_status;
    
    CREATE TYPE application_status AS ENUM (
      'pending', 
      'reviewed', 
      'interviewing', 
      'accepted', 
      'rejected'
    );
    
    ALTER TABLE job_applications 
    ALTER COLUMN status TYPE application_status 
    USING status::application_status;
    
    ALTER TABLE job_applications 
    ALTER COLUMN status SET DEFAULT 'pending';
  `);
}

export async function down(db: any) {
  // Revert changes if needed
  await db.execute(sql`
    ALTER TABLE job_applications 
    ALTER COLUMN status DROP DEFAULT;
    
    ALTER TABLE job_applications 
    ALTER COLUMN status TYPE TEXT;
    
    DROP TYPE IF EXISTS application_status;
    
    CREATE TYPE application_status AS ENUM (
      'pending', 
      'reviewing', 
      'accepted', 
      'rejected'
    );
    
    ALTER TABLE job_applications 
    ALTER COLUMN status TYPE application_status 
    USING status::application_status;
    
    ALTER TABLE job_applications 
    ALTER COLUMN status SET DEFAULT 'pending';
  `);
}
