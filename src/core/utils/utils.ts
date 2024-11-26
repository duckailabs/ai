export const formatToolData = (data: any, depth = 0): string => {
  if (!data) return "";

  let context = "";

  if (typeof data !== "object") {
    return String(data);
  }

  Object.entries(data).forEach(([key, value]) => {
    const formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());

    if (typeof value === "object") {
      context += `${formattedKey}:\n${formatToolData(value, depth + 1)}\n`;
    } else {
      let formattedValue = value;
      if (typeof value === "number") {
        formattedValue = Number.isInteger(value) ? value : value.toFixed(2);
      }
      context += `${formattedKey}: ${formattedValue}\n`;
    }
  });

  return context;
};
