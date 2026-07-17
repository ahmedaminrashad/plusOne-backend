import { extname } from 'path';
import { randomUUID } from 'crypto';
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SaveFcmTokenDto } from './dto/save-fcm-token.dto';
import { SaveLanguageDto } from './dto/save-language.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: './uploads/users',
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
  }))
  uploadPhoto(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadProfilePhoto(user.id, file);
  }

  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  saveFcmToken(@CurrentUser() user: User, @Body() dto: SaveFcmTokenDto) {
    return this.usersService.saveFcmToken(user.id, dto.fcmToken);
  }

  @Patch('me/language')
  @HttpCode(HttpStatus.NO_CONTENT)
  saveLanguage(@CurrentUser() user: User, @Body() dto: SaveLanguageDto) {
    return this.usersService.saveLanguage(user.id, dto.language);
  }
}
