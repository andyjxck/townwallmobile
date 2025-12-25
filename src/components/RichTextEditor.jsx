import React, { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { 
  actions, 
  RichEditor, 
  RichToolbar 
} from 'react-native-pell-rich-editor';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Palette, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  ChevronDown, 
  Undo2, 
  Redo2,
  Check
} from 'lucide-react-native';

const COLORS = [
  '#000000', '#FFFFFF', '#8E8E93', '#C7C7CC', '#FF3B30', '#FF9500', 
  '#FFCC00', '#4CD964', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
  '#2ECC71', '#3498DB', '#9B59B6', '#F1C40F', '#E67E22', '#E74C3C', 
  '#1ABC9C', '#34495E', '#D35400', '#BDC3C7', '#7F8C8D', '#2C3E50'
];

function ToolbarDropdown({ icon: Icon, label, options, onSelect, currentValue, type = 'list' }) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity 
        style={styles.dropdownTrigger} 
        onPress={() => setVisible(true)}
      >
          <Icon size={18} color="rgba(255,255,255,0.6)" />
          {label && <Text style={styles.dropdownText}>{label}</Text>}
          <ChevronDown size={10} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.dropdownMenu, type === 'color' && styles.colorMenu]}>
              {type === 'color' ? (
                <View style={styles.colorGrid}>
                  {COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorOption, { backgroundColor: color }]}
                      onPress={() => {
                        onSelect(color);
                        setVisible(false);
                      }}
                    >
                      {currentValue === color && (
                        <Check size={14} color={color === '#FFFFFF' ? '#000000' : '#FFFFFF'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      onSelect(option.value);
                      setVisible(false);
                    }}
                  >
                    <option.icon size={18} color={currentValue === option.value ? '#007AFF' : '#FFFFFF'} />
                    <Text style={[
                      styles.dropdownItemText,
                      currentValue === option.value && { color: '#007AFF', fontWeight: 'bold' }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 400 }) {
  const richText = useRef();
  const [currentAlignment, setCurrentAlignment] = useState('left');
  const [currentColor, setCurrentColor] = useState('#FFFFFF');

  const handleAlignmentSelect = (alignment) => {
    setCurrentAlignment(alignment);
    switch (alignment) {
      case 'left': richText.current?.executeAction(actions.alignLeft); break;
      case 'center': richText.current?.executeAction(actions.alignCenter); break;
      case 'right': richText.current?.executeAction(actions.alignRight); break;
    }
  };

  const handleListSelect = (type) => {
    if (type === 'bullets') {
      richText.current?.executeAction(actions.insertBulletsList);
    } else if (type === 'numbers') {
      richText.current?.executeAction(actions.insertOrderedList);
    }
  };

  const handleColorSelect = (color) => {
    setCurrentColor(color);
    richText.current?.focusContent();
    richText.current?.prepareCursor();
    richText.current?.executeAction(actions.foreColor, color);
  };

  const alignmentOptions = [
    { label: 'Left', value: 'left', icon: AlignLeft },
    { label: 'Center', value: 'center', icon: AlignCenter },
    { label: 'Right', value: 'right', icon: AlignRight },
  ];

  const listOptions = [
    { label: 'Bullets', value: 'bullets', icon: List },
    { label: 'Numbers', value: 'numbers', icon: ListOrdered },
  ];

  const CurrentAlignmentIcon = alignmentOptions.find(o => o.value === currentAlignment)?.icon || AlignLeft;

  return (
    <View style={styles.container}>
      <View style={styles.toolbarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
        >
          <ToolbarDropdown 
            icon={CurrentAlignmentIcon} 
            options={alignmentOptions}
            onSelect={handleAlignmentSelect}
            currentValue={currentAlignment}
          />

          <ToolbarDropdown 
            icon={List} 
            options={listOptions}
            onSelect={handleListSelect}
          />

          <ToolbarDropdown 
            icon={Palette} 
            type="color"
            onSelect={handleColorSelect}
            currentValue={currentColor}
          />

          <View style={styles.separator} />

          <RichToolbar
            editor={richText}
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.setUnderline,
            ]}
            iconMap={{
              [actions.setBold]: ({ tintColor }) => <Bold size={18} color={tintColor} />,
              [actions.setItalic]: ({ tintColor }) => <Italic size={18} color={tintColor} />,
              [actions.setUnderline]: ({ tintColor }) => <Underline size={18} color={tintColor} />,
            }}
            style={styles.subToolbar}
            flatContainerStyle={styles.flatStyle}
            selectedIconTint="#007AFF"
            iconTint="rgba(255,255,255,0.6)"
          />

          <View style={styles.separator} />

          <RichToolbar
            editor={richText}
            actions={[actions.undo, actions.redo]}
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
              color: #FFFFFF;
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
    paddingVertical: 10,
  },
  toolbarContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  subToolbar: {
    backgroundColor: 'transparent',
  },
  flatStyle: {
    paddingHorizontal: 0,
    gap: 12,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 8,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  colorMenu: {
    width: 280,
    padding: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 10,
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editorWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    marginVertical: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  richEditor: {
    flex: 1,
  },
});
