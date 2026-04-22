import { z } from 'zod';

export const employeeSchema = z.object({
  employee_number: z.string().min(1, "Employee number is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  position: z.string().min(1, "Position is required"),
  department: z.string().min(1, "Department is required"),
  hire_date: z.string().min(1, "Hire date is required"),
  salary_type: z.enum(['monthly', 'hourly']),
  base_salary: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)),
  housing_allowance: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().default(0),
  transport_allowance: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().default(0),
  other_allowance: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().default(0),
  annual_incentive_multiplier: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().default(0),
  nitaqat_points: z.number().min(0).or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().default(0),
  gosi_registered: z.boolean().optional().default(true),
  bank_iban: z.string().optional().or(z.literal('')),
  bank_name: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  role: z.enum(['employee', 'manager', 'admin', 'hr_manager', 'pending']).optional().default('employee'),
  grade: z.string().optional().or(z.literal('')).or(z.literal(null)),
});

export const leaveRequestSchema = z.object({
  employee_id: z.number().nullable(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  type: z.string().min(1, "Leave type is required"),
  reason: z.string().optional(),
});

export const warningSchema = z.object({
  employee_id: z.number(),
  warning_type: z.enum(['first', 'second', 'third', 'final', 'recognition']),
  reason: z.string().min(1, "Reason is required"),
  details: z.string().optional(),
  issued_by: z.string().optional()
});

export const attendanceSchema = z.object({
  employee_id: z.number(),
  date: z.string().min(1, "Date is required"),
  check_in: z.string().min(1, "Check-in time is required"),
  check_out: z.string().nullable().optional(),
  status: z.enum(['present', 'absent', 'late', 'half_day'])
});

export function validateSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation Error: ${errorMsg}`);
  }
  return result.data;
}
