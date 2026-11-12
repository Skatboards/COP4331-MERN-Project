import { View, Text, StyleSheet } from 'react-native';
import { colors, numberColors } from '../../constants/sweeple';

type CellProps = {
    size: number;
    revealed: boolean;
    adjacent: number;
};

export default function Cell(p: CellProps){
    let glyph = '';
    let glyphColor = colors.text;

    if(p.revealed && p.adjacent > 0){
        glyph = String(p.adjacent);
        glyphColor = numberColors[p.adjacent];
    }

    return(
        <View
        style = {[
            styles.cell,
            { width: p.size, height: p.size },
            p.revealed ? styles.open: styles.hidden,
        ]}
        >
            <Text style={[styles.glyph, { fontSize: p.size * 0.55, color: glyphColor}]}>{glyph}</Text>
        </View>
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
});