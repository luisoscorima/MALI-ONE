import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import {
  ScreenCastS3Picker,
  inferScreenCastMediaType,
} from '@/components/screen-cast-s3-picker';

type Props = {
  value: string;
  onChange: (url: string, inferredType?: 'image' | 'video' | 'gif') => void;
  id?: string;
  placeholder?: string;
};

export function ScreenCastMediaUrlField({
  value,
  onChange,
  id,
  placeholder = 'https://…',
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const url = e.target.value;
          onChange(url, url ? inferScreenCastMediaType(url) : undefined);
        }}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => setPickerOpen(true)}
        title="Elegir de S3"
      >
        <FolderOpen size={16} />
        S3
      </Button>
      <ScreenCastS3Picker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => onChange(url, inferScreenCastMediaType(url))}
      />
    </div>
  );
}
