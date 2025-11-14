export function getRequiredConnector4Family(
    obj1: { code: string; family: string, system: string },
    obj2: { code: string; family: string, system: string }
): string | null {

    const isProfile1 = obj1.family.includes("Profili");
    const isProfile2 = obj2.family.includes("Profili");
    const isConnector1 = obj1.family.includes("Connettor");
    const isConnector2 = obj2.family.includes("Connettor");

    // Special handling for XTen: works for profile-to-profile AND profile-to-connector
    if (obj1.system === "XTen" && obj2.system === "XTen") {
        // Add connector for: profile-to-profile OR profile-to-connector
        // Exclude: light-to-profile connections
        if ((isProfile1 && isProfile2) || (isProfile1 && isConnector2) || (isProfile2 && isConnector1)) {
            return getRequiredConnectorXTen(obj1, obj2);
        }
    }

    if (!isProfile1 || !isProfile2) {
        return null;
    }

    if (obj1.family !== obj2.family || obj1.system !== obj2.system) {
        return null;
    }

    if (obj1.system === "XNet" && obj2.system === "XNet") return getRequiredConnectorXnet(obj1, obj2);
    if (obj1.system === "XFive" && obj2.system === "XFive") return getRequiredConnectorXFive(obj1, obj2);
    if (obj1.system === "XFree S" && obj2.system === "XFree S") return "FES35CK";
    if (obj1.system === "XFreeM" && obj2.system === "XFreeM") return "FEM50CK";

    return null;
}

export function getRequiredConnectorXnet(
    obj1: { code: string; family: string },
    obj2: { code: string; family: string }
): string | null {

    const baseCode1 = obj1.code.split(' ')[0].split('+')[0];
    const baseCode2 = obj2.code.split(' ')[0].split('+')[0];

    const isCurved1 = baseCode1.endsWith('C');
    const isCurved2 = baseCode2.endsWith('C');

    if (!isCurved1 && !isCurved2) {
        return 'XNRS02LC';
    } else {
        return 'XNRS01LC';
    }
}

export function getRequiredConnectorXTen(
    _obj1: { code: string; family: string },
    _obj2: { code: string; family: string }
): string | null {
    // For XTen system, always add TNRS01LC for any connection
    // (profile-to-profile or profile-to-connector)
    return 'TNRS01LC';
}

export function getRequiredConnectorXFive(
    obj1: { code: string; family: string },
    obj2: { code: string; family: string }
): string | null {
    // For XFive system, add linear connectors based on profile colors
    // Only for profile-to-profile connections

    // Extract colors from codes (codes contain MBK or MWH)
    const hasMBK1 = obj1.code.includes('MBK');
    const hasMWH1 = obj1.code.includes('MWH');
    const hasMBK2 = obj2.code.includes('MBK');
    const hasMWH2 = obj2.code.includes('MWH');

    // Determine colors
    const color1 = hasMBK1 ? 'MBK' : hasMWH1 ? 'MWH' : null;
    const color2 = hasMBK2 ? 'MBK' : hasMWH2 ? 'MWH' : null;

    // If we can't determine colors, don't add connector
    if (!color1 || !color2) {
        return null;
    }

    // Apply color logic:
    // MBK + MBK = MBK
    // MWH + MWH = MWH
    // MBK + MWH = MBK (mixed = black)
    if (color1 === 'MBK' || color2 === 'MBK') {
        return 'FVRS01LC MBK';
    } else {
        return 'FVRS01LC MWH';
    }
}