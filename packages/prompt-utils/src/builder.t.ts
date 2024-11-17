import { PromptBuilder } from "./builder";

async function runExamples() {
  try {
    // Example 1: Basic chat with variables
    console.log("\n=== Example 1: Basic Chat ===");
    const basicTemplate =
      "<system>You are a helpful AI assistant.</system><user>My name is <name> and I need help with <task></user>";

    const basicBuilder = new PromptBuilder(basicTemplate).withContext({
      name: "Alice",
      task: "TypeScript",
    });

    console.log("Basic Chat Messages:");
    console.log(JSON.stringify(await basicBuilder.build(), null, 2));

    // Example 2: Multi-turn conversation
    console.log("\n=== Example 2: Multi-turn Conversation ===");
    const multiTurnTemplate = `
      <system>You are a coding tutor.</system>
      <user>I want to learn <language></user>
      <assistant>I'd be happy to help you learn <language>. What's your experience level?</assistant>
      <user>I'm a <level> developer</user>
    `;

    const multiTurnBuilder = new PromptBuilder(multiTurnTemplate).withContext({
      language: "Python",
      level: "beginner",
    });

    console.log("Multi-turn Messages:");
    console.log(JSON.stringify(await multiTurnBuilder.build(), null, 2));

    // Example 3: Database content integration
    console.log("\n=== Example 3: Database Content ===");
    // Simulating database content
    const dbContent = [
      { date: "2024-03-13", metric: "users", value: 1000 },
      { date: "2024-03-14", metric: "users", value: 1200 },
      { date: "2024-03-15", metric: "users", value: 1150 },
    ];

    const analyticsTemplate = `
      <system>You are a data analyst AI.</system>
      <user>Analyze this metrics data:
<data>

What are the key trends?</user>
    `;

    const formattedData = dbContent
      .map((row) => `${row.date}: ${row.metric} = ${row.value}`)
      .join("\n");

    const analyticsBuilder = new PromptBuilder(analyticsTemplate).withContext({
      data: formattedData,
    });

    console.log("Analytics Messages:");
    console.log(JSON.stringify(await analyticsBuilder.build(), null, 2));

    // Example 4: Named multi-agent conversation
    console.log("\n=== Example 4: Multi-agent Chat ===");
    const multiAgentTemplate = `
      <system>You are moderating a technical discussion.</system>
      <user name="developer">I'm working on <feature> and running into <problem></user>
      <assistant name="tech_lead">Let me help troubleshoot that. What have you tried so far?</assistant>
      <user name="developer">I tried <solution> but it didn't work.</user>
    `;

    const multiAgentBuilder = new PromptBuilder(multiAgentTemplate).withContext(
      {
        feature: "authentication system",
        problem: "JWT token validation issues",
        solution: "checking token expiration",
      }
    );

    console.log("Multi-agent Messages:");
    console.log(JSON.stringify(await multiAgentBuilder.build(), null, 2));

    // Example 5: Error handling demonstration
    console.log("\n=== Example 5: Error Handling ===");
    const invalidTemplate = `
      <system>You are an AI.</system>
      <user>Testing <undefinedVar></user>
    `;

    try {
      const invalidBuilder = new PromptBuilder(invalidTemplate);
      const validation = await invalidBuilder.validate();
      console.log("Validation results:", validation);
    } catch (error) {
      console.error("Caught error:", error);
    }

    // Example 6: Using with OpenAI (commented out to avoid actual API calls)
    console.log("\n=== Example 6: OpenAI Integration ===");
    const openAiTemplate = `
      <system>You are a code review assistant.</system>
      <user>Review this code:
<code>

Focus on: <focus></user>
    `;

    const codeBuilder = new PromptBuilder(openAiTemplate).withContext({
      code: `function add(a: number, b: number): number {
  return a + b;
}`,
      focus: "type safety and error handling",
    });

    const messages = await codeBuilder.build();
    console.log("Messages ready for OpenAI:");
    console.log(JSON.stringify(messages, null, 2));

    /* Uncomment to actually call OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages
    });

    console.log('\nOpenAI Response:');
    console.log(completion.choices[0].message);
    */
  } catch (error) {
    console.error("Error in examples:", error);
  }
}

// Run all examples
runExamples()
  .then(() => {
    console.log("\nAll examples completed!");
  })
  .catch((error) => {
    console.error("Failed to run examples:", error);
  });
