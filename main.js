const favicon = document.getElementById("favicon");
const canvas = document.getElementById("canvas");
const downloadButton = document.getElementById("download-button");
const editor = document.getElementById("editor");
const previewImages = Array.from(document.getElementsByClassName("preview"));

const quill = new Quill(editor, {
    formats: ["italic", "color", "background"],
    modules: {
        toolbar: [
            "italic",
            {
                "color": []
            },
            {
                "background": []
            },
        ],
    },
    theme: "snow",
});

const ctx = canvas.getContext("2d");

function convertOperation(op, fontSize) {
    const attributes = op.attributes || {};
    return {
        ctx: {
            fillStyle: attributes.color || "#000000",
            font: (attributes.italic ? "italic " : "") + FONT_WEIGHT + " " + fontSize + "px " + FONT_FAMILY,
            lineWidth: Math.max(0.2 * fontSize, 0.075 * canvas.width),
            strokeStyle: attributes.background || "#FFFFFF",
        },
        text: op.insert,
    };
}

function buildLayout(lines, maxWidth, maxHeight, fontSize) {
    const layout = {
        lines: new Array(lines.length),
    };

    let ascent = -Infinity;
    let descent = -Infinity;
    let lineHeight = 0;

    for (const [i, line] of lines.entries()) {
        layout.lines[i] = {
            operations: new Array(line.ops.length),
        };

        let lineWidth = 0;

        for (const [j, op] of line.ops.entries()) {
            const operation = convertOperation(op, fontSize);
            Object.assign(ctx, operation.ctx);

            if (j == 0) {
                lineWidth += ctx.lineWidth;
            }

            const textMetrics = ctx.measureText(operation.text);
            ascent = Math.max(ascent, textMetrics.actualBoundingBoxAscent);
            descent = Math.max(descent, textMetrics.actualBoundingBoxDescent);

            lineHeight = ascent + descent + ctx.lineWidth;
            if (lineHeight > maxHeight) {
                return null;
            }

            const width = (j == line.ops.length - 1) ? (textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight) : textMetrics.width;

            lineWidth += width;
            if (lineWidth > maxWidth) {
                return null;
            }

            layout.lines[i].operations[j] = {
                ctx: operation.ctx,
                text: operation.text,
                width: width,
            };
        }

        layout.lines[i].offsetX = (maxWidth - lineWidth + ctx.lineWidth) / 2;
    }

    const padding = (maxHeight - lineHeight) * lines.length / 2;
    layout.offsetY = ctx.lineWidth / 2 + padding + ascent;
    layout.lineHeight = lineHeight;

    return layout;
}

function binarySearchMaximum(low, high, callback) {
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (callback(mid)) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return low - 1;
}

function updateCanvas() {
    ctx.miterLimit = 2;
    ctx.textBaseline = "top";

    const contents = quill.getContents();

    const text = contents.ops.map((op) => op.insert).join("");
    const filename = text.replace(/[^A-Za-z0-9_]+/g, "-").replace(/-+$/g, "");

    const lines = [];
    contents.eachLine((line) => lines.push(line));

    const maxWidth = canvas.width;
    const maxHeight = canvas.height / lines.length;

    const layout = (function() {
        const layouts = {};
        const index = binarySearchMaximum(0, maxHeight * 2, (index) => {
            const fontSize = index + 1;
            return (layouts[index] = buildLayout(lines, maxWidth, maxHeight, fontSize)) != null;
        });
        return layouts[index];
    })();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let y = layout.offsetY;
    for (const line of layout.lines) {
        let x = line.offsetX;
        for (const operation of line.operations) {
            Object.assign(ctx, operation.ctx);
            ctx.strokeText(operation.text, x, y);
            x += operation.width;
        }
        x = line.offsetX;
        for (const operation of line.operations) {
            Object.assign(ctx, operation.ctx);
            ctx.fillText(operation.text, x, y);
            x += operation.width;
        }
        y += layout.lineHeight;
    }

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        favicon.href = url;
        downloadButton.download = filename + ".png";
        downloadButton.href = url;
        previewImages.forEach((img) => img.src = url);
    }, "image/png", 1);
}

quill.on("text-change", (delta, oldDelta, source) => updateCanvas());
