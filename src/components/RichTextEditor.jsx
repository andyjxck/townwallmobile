import React, { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TouchableWithoutFeedback
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
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Undo2,
  Redo2,
  Trash2,
  Plus
} from 'lucide-react-native';

const COLORS = [
  '#000000', '#FFFFFF', '#FF3B30', '#4CD964', '#007AFF', 
  '#FFCC00', '#5856D6', '#FF9500', '#8E8E93', '#C7C7CC',
  '#2ECC71', '#3498DB', '#9B59B6', '#F1C40F', '#E67E22',
  '#E74C3C', '#1ABC9C', '#34495E', '#D35400', '#BDC3C7'
];

function HeaderDropdown({ currentHeader, onSelect }) {
  const [visible, setVisible] = useState(false);

  const options = [
    { label: 'Paragraph', value: 'p', icon: Type },
    { label: 'Heading 1', value: 'h1', icon: Heading1 },
    { label: 'Heading 2', value: 'h2', icon: Heading2 },
    { label: 'Heading 3', value: 'h3', icon: Heading3 },
  ];

  const currentOption = options.find(o => o.value === currentHeader) || options[0];

  return (
    <View>
      <TouchableOpacity 
        style={styles.dropdownTrigger} 
        onPress={() => setVisible(true)}
      >
        <currentOption.icon size={18} color="#FFFFFF" />
        <Text style={styles.dropdownText}>{currentOption.label}</Text>
        <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownMenu}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.dropdownItem}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <option.icon size={18} color={currentHeader === option.value ? '#007AFF' : '#FFFFFF'} />
                  <Text style={[
                    styles.dropdownItemText,
                    currentHeader === option.value && { color: '#007AFF', fontWeight: 'bold' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 400 }) {
  const richText = useRef();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentHeader, setCurrentHeader] = useState('p');

  const onInsertImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const item = result.assets[0];
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
      }
    }
  };

  const handleHeaderSelect = (header) => {
    setCurrentHeader(header);
    if (header === 'h1') {
      richText.current?.executeAction(actions.heading1);
    } else if (header === 'h2') {
      richText.current?.executeAction(actions.heading2);
    } else if (header === 'h3') {
      richText.current?.executeAction(actions.heading3);
    } else if (header === 'p') {
      richText.current?.executeAction(actions.setParagraph);
    }
  };

  const handleColorSelect = (color) => {
    richText.current?.prepareCursor();
    richText.current?.executeAction(actions.foreColor, color);
    setShowColorPicker(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
        >
          <HeaderDropdown 
            currentHeader={currentHeader} 
            onSelect={handleHeaderSelect} 
          />
          
          <View style={styles.separator} />

            <RichToolbar
              editor={richText}
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.foreColor,
              ]}
              iconMap={{
                [actions.setBold]: ({ tintColor }) => <Bold size={18} color={tintColor} />,
                [actions.setItalic]: ({ tintColor }) => <Italic size={18} color={tintColor} />,
                [actions.setUnderline]: ({ tintColor }) => <Underline size={18} color={tintColor} />,
                [actions.foreColor]: ({ tintColor }) => <Palette size={18} color={tintColor} />,
              }}
              onPressAction={(action) => {
                if (action === actions.foreColor) {
                  setShowColorPicker(!showColorPicker);
                }
              }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />

          <View style={styles.separator} />

          <RichToolbar
            editor={richText}
            actions={[
              actions.alignLeft,
              actions.alignCenter,
              actions.alignRight,
            ]}
            iconMap={{
              [actions.alignLeft]: ({ tintColor }) => <AlignLeft size={18} color={tintColor} />,
              [actions.alignCenter]: ({ tintColor }) => <AlignCenter size={18} color={tintColor} />,
              [actions.alignRight]: ({ tintColor }) => <AlignRight size={18} color={tintColor} />,
            }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />

          <View style={styles.separator} />

            <RichToolbar
              editor={richText}
              actions={[
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.insertImage,
              ]}
              iconMap={{
                [actions.insertBulletsList]: ({ tintColor }) => <List size={18} color={tintColor} />,
                [actions.insertOrderedList]: ({ tintColor }) => <ListOrdered size={18} color={tintColor} />,
                [actions.insertImage]: ({ tintColor }) => <ImageIcon size={18} color={tintColor} />,
              }}
              onPressAction={(action) => {
                if (action === actions.insertImage) {
                  onInsertImage();
                }
              }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />

          <View style={styles.separator} />

          <RichToolbar
            editor={richText}
            actions={[
              actions.undo,
              actions.redo,
            ]}
            iconMap={{
              [actions.undo]: ({ tintColor }) => <Undo2 size={18} color={tintColor} />,
              [actions.redo]: ({ tintColor }) => <Redo2 size={18} color={tintColor} />,
            }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />
        </ScrollView>

        {showColorPicker && (
          <View style={styles.colorPickerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleColorSelect(color)}
                  style={[styles.colorOption, { backgroundColor: color }]}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={[styles.editorWrapper, { minHeight }]}>
        <RichEditor
          ref={richText}
          initialContentHTML={value}
          onChange={onChange}
          placeholder={placeholder}
          editorStyle={{
            backgroundColor: '#000000',
            color: '#FFFFFF',
            placeholderColor: 'rgba(255,255,255,0.2)',
            contentCSSText: `
              font-size: 18px; 
              line-height: 28px; 
              font-family: -apple-system, sans-serif;
              padding: 15px;
            `,
          }}
          style={styles.richEditor}
          useContainer={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
  },
  toolbarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111111',
    paddingVertical: 8,
  },
  toolbarContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  subToolbar: {
    backgroundColor: 'transparent',
    minWidth: 40,
  },
  flatStyle: {
    paddingHorizontal: 0,
    gap: 12,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 8,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 8,
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  colorPickerContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editorWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  richEditor: {
    flex: 1,
  },
});
