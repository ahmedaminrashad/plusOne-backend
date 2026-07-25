import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { AddFriendDto } from './dto/add-friend.dto';
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

  @Post()
  addFriend(@CurrentUser() user: any, @Body() dto: AddFriendDto) {
    return this.friendsService.addFriend(user.id, dto);
  }

  @Delete(':id')
  removeFriend(@CurrentUser() user: any, @Param('id') id: string) {
    return this.friendsService.removeFriend(user.id, id);
  }
}
