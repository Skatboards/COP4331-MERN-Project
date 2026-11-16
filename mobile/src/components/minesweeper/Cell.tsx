import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, numberColors } from '../../constants/sweeple';

type CellProps = {
    size: number;
    revealed: boolean;
    adjacent: number;
    onPress: (index: number) => void;
    index: number;
    flagged: boolean;
    onLongPress: (index: number) => void;
    showMine: boolean;
    exploded: boolean;
    wrongFlag: boolean;
    won: boolean;
    disabled: boolean;
};

export default function Cell(p: CellProps){
    let glyph = '';
    let glyphColor = colors.text;

    if(p.revealed){
        if(p.adjacent > 0){
            glyph = String(p.adjacent);
            glyphColor = numberColors[p.adjacent];
        }
    } else if (p.showMine){
        glyph = p.won ? '⚑' : '*';
        glyphColor = p.exploded ? '#ffffff' : colors.text;
    } else if (p.wrongFlag) {
        glyph = '✕';
        glyphColor = colors.error;
    } else if (p.flagged) {
        glyph = '⚑';
        glyphColor = colors.brand;
    }

    return(
        <Pressable
            onPress={() => p.onPress(p.index)}
            onLongPress={() => p.onLongPress(p.index)}
            delayLongPress={300}
            disabled ={p.disabled}
        style = {[
            styles.cell,
            { width: p.size, height: p.size },
            p.revealed ? styles.open: styles.hidden,
            p.exploded && styles.boom
        ]}
        >
            <Text style={[styles.glyph, { fontSize: p.size * 0.55, color: glyphColor}]}>{glyph}</Text>
        </Pressable>
    );
}


const styles = StyleSheet.create({
    cell: { alignItems: 'center', justifyContent: 'center'},
    hidden: {
        backgroundColor: colors.cell,
        borderWidth: 2,
        borderTopColor: colors.surfaceHover,
        borderLeftColor: colors.surfaceHover,
        borderBottomColor: colors.cellBorder,
        borderRightColor: colors.cellBorder,
    },
    open: { backgroundColor: colors.surface},
    glyph: {fontWeight: '700'},
    boom: { backgroundColor: colors.error},
});