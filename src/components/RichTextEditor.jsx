import React, { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { 
  actions, 
  RichEditor, 
  RichToolbar, 
  defaultActions 
} from 'react-native-pell-rich-editor';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../utils/supabase';
import { 
  Bold, 
  Italic, 
  Underline, 
  Type, 
  List, 
  ListOrdered, 
  Image as ImageIcon, 
  Link as LinkIcon,
  Quote,
  Code,
  Minus,
  Palette,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react-native';

const customActions = [
  ...defaultActions,
  actions.setStrikethrough,
  actions.heading1,
  actions.heading2,
  actions.heading3,
  actions.setHR,
  actions.insertLink,
  actions.quote,
  actions.code,
  'foreColor',
  'hiliteColor',
];

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
  '#ffff00', '#ff00ff', '#00ffff', '#888888', '#444444'
];

export function RichTextEditor({ value, onChange, placeholder }) {
  const richText = useRef();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorMode, setColorMode] = useState('foreColor'); // 'foreColor' or 'hiliteColor'

  const onInsertImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const item = result.assets[0];
      
      // Upload to Supabase
      const fileExt = item.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `rich-text/${fileName}`;

      try {
        const arrayBuffer = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = () => reject(new TypeError("Network request failed"));
          xhr.responseType = "arraybuffer";
          xhr.open("GET", item.uri, true);
          xhr.send(null);
        });

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);
        
        richText.current?.insertImage(publicUrlData.publicUrl);
      } catch (error) {
        console.error("Image upload error:", error);
        alert("Failed to upload image.");
      }
    }
  };

  const handleCustomAction = (action) => {
    if (action === 'foreColor') {
      setColorMode('foreColor');
      setShowColorPicker(!showColorPicker);
    } else if (action === 'hiliteColor') {
      setColorMode('hiliteColor');
      setShowColorPicker(!showColorPicker);
    }
  };

  const onSelectColor = (color) => {
    if (colorMode === 'foreColor') {
      richText.current?.prepareCursor();
      richText.current?.executeAction('foreColor', color);
    } else {
      richText.current?.prepareCursor();
      richText.current?.executeAction('hiliteColor', color);
    }
    setShowColorPicker(false);
  };

  return (
    <View style={styles.container}>
      <RichToolbar
        editor={richText}
        actions={[
          actions.setBold,
          actions.setItalic,
          actions.setUnderline,
          actions.setStrikethrough,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.heading1,
          actions.heading2,
          actions.heading3,
          actions.setHR,
          actions.insertLink,
          actions.quote,
          actions.code,
          actions.alignLeft,
          actions.alignCenter,
          actions.alignRight,
          actions.alignFull,
          'foreColor',
          'hiliteColor',
          'insertImage',
          actions.undo,
          actions.redo,
          actions.removeFormat,
        ]}
        iconMap={{
          [actions.setBold]: ({ tintColor }) => <Bold size={20} color={tintColor} />,
          [actions.setItalic]: ({ tintColor }) => <Italic size={20} color={tintColor} />,
          [actions.setUnderline]: ({ tintColor }) => <Underline size={20} color={tintColor} />,
          [actions.setStrikethrough]: ({ tintColor }) => <Type size={20} color={tintColor} strokeWidth={3} />,
          [actions.insertBulletsList]: ({ tintColor }) => <List size={20} color={tintColor} />,
          [actions.insertOrderedList]: ({ tintColor }) => <ListOrdered size={20} color={tintColor} />,
          [actions.heading1]: ({ tintColor }) => <Heading1 size={20} color={tintColor} />,
          [actions.heading2]: ({ tintColor }) => <Heading2 size={20} color={tintColor} />,
          [actions.heading3]: ({ tintColor }) => <Heading3 size={20} color={tintColor} />,
          [actions.setHR]: ({ tintColor }) => <Minus size={20} color={tintColor} />,
          [actions.insertLink]: ({ tintColor }) => <LinkIcon size={20} color={tintColor} />,
          [actions.quote]: ({ tintColor }) => <Quote size={20} color={tintColor} />,
          [actions.code]: ({ tintColor }) => <Code size={20} color={tintColor} />,
          [actions.alignLeft]: ({ tintColor }) => <AlignLeft size={20} color={tintColor} />,
          [actions.alignCenter]: ({ tintColor }) => <AlignCenter size={20} color={tintColor} />,
          [actions.alignRight]: ({ tintColor }) => <AlignRight size={20} color={tintColor} />,
          [actions.alignFull]: ({ tintColor }) => <AlignJustify size={20} color={tintColor} />,
          foreColor: ({ tintColor }) => <Palette size={20} color={tintColor} />,
          hiliteColor: ({ tintColor }) => <Palette size={20} color={tintColor} fill={tintColor} />,
          insertImage: ({ tintColor }) => <ImageIcon size={20} color={tintColor} />,
          [actions.removeFormat]: ({ tintColor }) => <Eraser size={20} color={tintColor} />,
        }}
        onPressAction={handleCustomAction}
        insertImage={onInsertImage}
        style={styles.richBar}
        flatContainerStyle={styles.flatStyle}
        selectedIconTint="#FFFFFF"
        iconTint="rgba(255,255,255,0.4)"
      />

      {showColorPicker && (
        <ScrollView horizontal style={styles.colorPicker} showsHorizontalScrollIndicator={false}>
          {COLORS.map(color => (
            <TouchableOpacity
              key={color}
              onPress={() => onSelectColor(color)}
              style={[styles.colorOption, { backgroundColor: color }]}
            />
          ))}
        </ScrollView>
      )}

      <RichEditor
        ref={richText}
        initialContentHTML={value}
        onChange={onChange}
        placeholder={placeholder}
        editorStyle={{
          backgroundColor: 'transparent',
          color: '#FFFFFF',
          placeholderColor: 'rgba(255,255,255,0.2)',
          contentCSSText: `
            font-size: 18px; 
            line-height: 28px; 
            font-family: -apple-system, sans-serif;
            padding: 0;
          `,
        }}
        style={styles.richEditor}
        useContainer={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  richBar: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  flatStyle: {
    paddingHorizontal: 10,
  },
  richEditor: {
    flex: 1,
    minHeight: 300,
  },
  colorPicker: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    flexDirection: 'row',
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  }
});
