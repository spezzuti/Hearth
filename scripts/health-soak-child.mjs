for (let index = 1; index <= 16; index += 1) {
  console.log(`HEARTH-SOAK-${index}`);
  await new Promise((resolve) => setTimeout(resolve, 900));
}
