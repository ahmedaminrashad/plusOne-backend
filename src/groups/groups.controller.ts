import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteMembersDto } from './dto/invite-members.dto';
import { ChatNotificationDto } from './dto/chat-notification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(@CurrentUser() user: User, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(user.id, dto);
  }

  @Get()
  getMyGroups(@CurrentUser() user: User) {
    return this.groupsService.getUserGroups(user.id);
  }

  @Get('invitations')
  getMyInvitations(@CurrentUser() user: User) {
    return this.groupsService.getMyInvitations(user.id, user.phone);
  }

  @Patch('invitations/:membershipId/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  acceptInvitation(@CurrentUser() user: User, @Param('membershipId') membershipId: string) {
    return this.groupsService.acceptInvitation(membershipId, user.id);
  }

  @Patch('invitations/:membershipId/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  declineInvitation(@CurrentUser() user: User, @Param('membershipId') membershipId: string) {
    return this.groupsService.declineInvitation(membershipId, user.id);
  }

  @Get(':id')
  getGroup(@CurrentUser() user: User, @Param('id') id: string) {
    return this.groupsService.getGroup(id, user.id);
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: User, @Param('id') id: string) {
    return this.groupsService.getMembers(id, user.id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  inviteMembers(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: InviteMembersDto,
  ) {
    return this.groupsService.inviteMembers(id, user.id, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupsService.removeMember(id, user.id, memberId);
  }

  @Post(':id/chat-image')
  @UseInterceptors(FileInterceptor('image'))
  uploadChatImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.groupsService.uploadChatImage(id, user.id, file);
  }

  @Post(':id/chat-notification')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendChatNotification(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ChatNotificationDto,
  ) {
    return this.groupsService.sendChatNotification(id, user.id, dto.senderName, dto.messagePreview);
  }
}
