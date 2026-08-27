import { Controller, Get, Post, Patch, Delete, Body, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PromoCodesService } from './promocodes.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `promo-example-${uniqueSuffix}${ext}`);
  },
});

@Controller('promocodes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Get()
  async getAll() {
    return this.promoCodesService.findAll();
  }

  @Get('detailed')
  async getAllDetailed() {
    return this.promoCodesService.findAllDetailed();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  async uploadExampleImage(@UploadedFile() file: any) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    try {
      // Automatically optimize & compress the image with sharp to stay well under Telegram's 10MB limit
      const sharp = require('sharp');
      const optimizedFilename = `opt-${file.filename}`;
      const optimizedPath = path.join(process.cwd(), 'uploads', optimizedFilename);

      await sharp(file.path)
        .resize({ width: 1600, withoutEnlargement: true })
        .png({ quality: 80, compressionLevel: 8 })
        .toFile(optimizedPath);

      // Remove the original uncompressed heavy file if different
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}

      return { url: `/uploads/${optimizedFilename}` };
    } catch (err) {
      // If sharp fails for any reason, return the raw uploaded file
      return { url: `/uploads/${file.filename}` };
    }
  }

  @Post()
  async create(@Body() body: { code: string; bookmaker: string; exampleImageUrl?: string }) {
    return this.promoCodesService.create(body);
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string) {
    return this.promoCodesService.toggleActive(id);
  }

  @Patch(':id/image')
  async updateImage(@Param('id') id: string, @Body() body: { exampleImageUrl: string }) {
    return this.promoCodesService.updateExampleImage(id, body.exampleImageUrl);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.promoCodesService.delete(id);
  }
}
