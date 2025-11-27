import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { users } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

// Static code Backend team please change it to dynamic - Real auth replaces mock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, name, phone, role } = validation.data;

    // Check if user already exists
    if (users.get(email)) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user
    const newUser = {
      id: (users.size + 1).toString(),
      email,
      password: hashedPassword,
      name,
      phone,
      role: role || 'user', // Default to 'user' if not specified
      emailVerified: null,
      verificationToken,
      verificationExpires,
    };

    users.set(email, newUser);

    // Send verification email
    await sendVerificationEmail(email, verificationToken, name);

    return NextResponse.json({
      message: 'Registration successful! Please check your email for verification code.',
      userId: newUser.id,
      requiresVerification: true,
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
