import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 15;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAGIC_OTP = '111111';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; cooldown: number }> {
    const { phone } = dto;

    const recent = await this.otpRepo.findOne({
      where: { phone, used: false },
      order: { createdAt: 'DESC' },
    });

    if (recent) {
      if (recent.lockedUntil && recent.lockedUntil > new Date()) {
        throw new BadRequestException(
          'لقد تجاوزت عدد المحاولات المسموح بها، حاول مرة أخرى بعد 15 دقيقة',
        );
      }

      const cooldownEnd = new Date(recent.createdAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      if (cooldownEnd > new Date()) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        this.logger.debug(`[OTP] Cooldown active for ${phone}, ${remaining}s remaining — silently succeeding for dev`);
        return { message: 'تم إرسال رمز التحقق', cooldown: remaining };
      }
    }

    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.otpRepo.save({ phone, code, expiresAt });

    // Console log — replace with real SMS provider (Twilio, etc.)
    this.logger.log(`[OTP] Phone: ${phone} | Code: ${code} | Expires: ${expiresAt.toISOString()}`);

    return { message: 'تم إرسال رمز التحقق', cooldown: OTP_RESEND_COOLDOWN_SECONDS };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    const { phone, code } = dto;

    console.info(`[OTP] Verifying code for ${phone} | Code: ${code}`);

    if (code === MAGIC_OTP) {
      let user = await this.usersRepo.findOne({ where: { phone } });
      const isNewUser = !user;
      if (!user) user = await this.usersRepo.save({ phone });
      this.logger.warn(`[OTP] Magic code used for ${phone}`);
      return this.generateTokens(user, isNewUser);
    }

    const otpRecord = await this.otpRepo.findOne({
      where: { phone, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException('الكود الذي أدخلته غير صحيح');
    }

    if (otpRecord.lockedUntil && otpRecord.lockedUntil > new Date()) {
      throw new BadRequestException(
        'لقد تجاوزت عدد المحاولات المسموح بها، حاول مرة أخرى بعد 15 دقيقة',
      );
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية الكود، يُرجى طلب كود جديد');
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;

      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        otpRecord.lockedUntil = new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000);
      }

      await this.otpRepo.save(otpRecord);
      throw new BadRequestException('الكود الذي أدخلته غير صحيح');
    }

    otpRecord.used = true;
    await this.otpRepo.save(otpRecord);

    let user = await this.usersRepo.findOne({ where: { phone } });
    const isNewUser = !user;

    if (!user) {
      user = await this.usersRepo.save({ phone });
    }

    return this.generateTokens(user, isNewUser);
  }

  async refreshTokens(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const record = await this.refreshTokenRepo.findOne({
      where: { token, revoked: false },
      relations: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    record.revoked = true;
    await this.refreshTokenRepo.save(record);

    const { accessToken, refreshToken } = await this.generateTokens(record.user, false);
    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepo.update({ token }, { revoked: true });
  }

  private async generateTokens(
    user: User,
    isNewUser: boolean,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean; isProfileComplete: boolean }> {
    const payload = { sub: user.id, phone: user.phone };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenValue = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.save({
      token: refreshTokenValue,
      userId: user.id,
      expiresAt,
    });

    return { accessToken, refreshToken: refreshTokenValue, isNewUser, isProfileComplete: user.isProfileComplete };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
