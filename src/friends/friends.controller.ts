import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { AddFriendDto } from './dto/add-friend.dto';
import { LookupPhonesDto } from './dto/lookup-phones.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  listCircle(@CurrentUser() user: any) {
    return this.friendsService.listCircle(user.id);
  }

  @Post('lookup')
  lookup(@Body() dto: LookupPhonesDto) {
    return this.friendsService.lookupRegistered(dto.phones);
  }

  @Post()
  addFriend(@CurrentUser() user: any, @Body() dto: AddFriendDto) {
    return this.friendsService.addFriend(user.id, dto);
  }

  @Post(':id/share')
  shareInvite(@CurrentUser() user: any, @Param('id') id: string) {
    return this.friendsService.shareInvite(user.id, id);
  }

  @Delete(':id')
  removeFriend(@CurrentUser() user: any, @Param('id') id: string) {
    return this.friendsService.removeFriend(user.id, id);
  }
}
