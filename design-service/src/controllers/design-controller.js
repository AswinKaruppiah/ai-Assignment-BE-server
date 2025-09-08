const Design = require("../models/design");
const axios = require("axios");

exports.getUserDesigns = async (req, res) => {
  try {
    const userId = req.user.userId;

    const designs = await Design.find({ userId }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: designs,
    });
  } catch (e) {
    console.error("Error fetching designs", e);
    res.status(500).json({
      success: false,
      message: "Failed to fetch designs",
    });
  }
};

exports.getUserDesignsByID = async (req, res) => {
  try {
    const userId = req.user.userId;
    const designId = req.params.id;

    const design = await Design.findOne({ _id: designId, userId });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Design not found! or you don't have permission to view it.",
      });
    }

    res.status(200).json({
      success: true,
      data: design,
    });
  } catch (e) {
    console.error("Error fetching design by ID", e);
    res.status(500).json({
      success: false,
      message: "Failed to fetch design by ID",
    });
  }
};

exports.saveDesign = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { designId, name, canvasData, width, height, category } = req.body;
    if (designId) {
      const design = await Design.findOne({ _id: designId, userId });
      if (!design) {
        return res.status(404).json({
          success: false,
          message: "Design not found! or you don't have permission to view it.",
        });
      }

      if (name) design.name = name;
      if (canvasData) design.canvasData = canvasData;
      if (width) design.width = width;
      if (height) design.height = height;
      if (category) design.category = category;

      design.updatedAt = Date.now();
      const updatedDesign = await design.save();

      return res.status(200).json({
        success: true,
        data: updatedDesign,
      });
    } else {
      const newDesign = new Design({
        userId,
        name: name || "Untitled Design",
        width,
        height,
        canvasData,
        category,
      });

      const saveDesign = await newDesign.save();
      return res.status(200).json({
        success: true,
        data: saveDesign,
      });
    }
  } catch (e) {
    console.error("Error while saving design", e);
    res.status(500).json({
      success: false,
      message: "Failed to save design",
    });
  }
};

exports.deleteDesign = async (req, res) => {
  try {
    const userId = req.user.userId;
    const designId = req.params.id;
    const design = await Design.findOne({ _id: designId, userId });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Design not found! or you don't have permission to delete it.",
      });
    }

    await Design.deleteOne({ _id: designId });

    res.status(200).json({
      success: true,
      message: "Design deleted successfully",
    });
  } catch (e) {
    console.error("Error while deleting design", e);
    res.status(500).json({
      success: false,
      message: "Failed to delete design",
    });
  }
};

exports.generatePrompt = async (req, res) => {
  try {
    const { prompt, id } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        message: "'prompt' is required in request body",
      });
    }

    // Fetch design from DB
    const design = await Design.findOne({ _id: id });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Design not found! or you don't have permission to view it.",
      });
    }

    if (!process.env.AIML_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Server missing AIML API key",
      });
    }

    // Prepare messages for AI
    const messages = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: `
"Always return a valid Fabric.js JSON object (no extra text, no markdown).",
"Preserve all existing images from design.objects.",
"Image placement:",
" - If only one image → make it a full-width hero/cover image at the top (40–50% of canvas height).",
"Text placement & style:",
" - Headline → large, bold, top-centered or over hero image, eye-catching.",
" - Highlights → mid section, professional font, aligned left or center, use spacing.",
" - Call-to-action → bold, bottom area, with contrast color background or highlight.",
"Visual style:",
" - Use emojis for engagement (🏡 ✨ 📍 📞).",
" - Maintain proportional font sizes relative to canvas width/height.",
" - Ensure good contrast (dark text on light bg or light on dark).",
" - Avoid overlapping text with images.",
" - Use modern fonts (sans-serif, clean).",
"Layout:",
" - Balanced spacing between text blocks.",
" - Grid or aligned arrangement for multiple images.",
" - Minimalist, professional, modern aesthetic."
        `,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the user template canvas data: ${JSON.stringify(
              design
            )}.`,
          },
          {
            type: "text",
            text: `Also consider this user prompt when adjusting the template: "${prompt}"`,
          },
        ],
      },
    ];

    console.log("--------------started--------------");

    // Call OpenRouter API
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AIML_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    console.log("--------------Ended--------------");

    const result = response.data.choices?.[0]?.message?.content || "";

    console.log(result);

    const aiResponse = response.data.choices[0]?.message?.content || "";

    // 🚀 Replace canvasData in DB with AI response
    design.canvasData = aiResponse;
    await design.save();

    res.status(200).json({
      success: true,
      message: "successfully",
    });
  } catch (e) {
    console.log("Error while generating AI response", e?.response?.data || e);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI response",
    });
  }
};
