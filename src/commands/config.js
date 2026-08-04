const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  SETTING_DEFS,
  getSetting,
  setSetting,
  formatSettingValue,
} = require("../config/settings");

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 };

// Special autocomplete/typed value that clears the timezone override.
const TZ_DEFAULT = "default";

let cachedTimezones = null;
function allTimezones() {
  if (!cachedTimezones) cachedTimezones = Intl.supportedValuesOf("timeZone");
  return cachedTimezones;
}

function isValidTimezone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or change your personal settings")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Show your current settings"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("datepicker")
        .setDescription("How dates are entered when adding or editing entries")
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("ui (dropdown pickers, default) or textbox")
            .setRequired(true)
            .addChoices(
              { name: "ui", value: "ui" },
              { name: "textbox", value: "textbox" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timepicker")
        .setDescription("How times are entered when adding or editing entries")
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("ui (dropdown pickers, default) or textbox")
            .setRequired(true)
            .addChoices(
              { name: "ui", value: "ui" },
              { name: "textbox", value: "textbox" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("autoclockoutduration")
        .setDescription("Automatically clock out after this long (0 = off)")
        .addIntegerOption((option) =>
          option
            .setName("duration")
            .setDescription("How long, in the chosen unit (0 turns it off)")
            .setMinValue(0)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("unit")
            .setDescription("Time unit for the duration (default: hours)")
            .setRequired(false)
            .addChoices(
              { name: "Minutes", value: "minutes" },
              { name: "Hours", value: "hours" },
              { name: "Days", value: "days" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("longshiftnotification")
        .setDescription("Toggle the DM sent when you stay clocked in too long")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("true to receive the reminder DM (default: true)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timezone")
        .setDescription("Timezone used when you enter and view dates")
        .addStringOption((option) =>
          option
            .setName("zone")
            .setDescription('An IANA zone like "America/New_York", or "default"')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();

    const matches = allTimezones()
      .filter((zone) => zone.toLowerCase().includes(focused))
      .slice(0, 24)
      .map((zone) => ({ name: zone, value: zone }));

    // Always offer the way back to the server default.
    matches.unshift({
      name: `default (use server timezone)`,
      value: TZ_DEFAULT,
    });

    await interaction.respond(matches.slice(0, 25));
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    dbHelpers.getOrCreateUser(userId, interaction.user.username);

    const sub = interaction.options.getSubcommand();

    if (sub === "view") {
      const raw = dbHelpers.getAllUserSettings(userId);

      const lines = Object.entries(SETTING_DEFS).map(([name, def]) => {
        const value = getSetting(userId, name);
        let display = formatSettingValue(name, value);

        if (name === "defaultproject" && value !== null) {
          const project = dbHelpers.getProjectById(Number(value));
          display = project ? project.name : `unknown project (id ${value})`;
        }
        if (name === "timezone" && value === null) {
          display = `server default (${process.env.TIMEZONE || "not configured"})`;
        }

        const isDefault = raw[name] === undefined;
        return `**${name}**: ${display}${isDefault ? " *(default)*" : ""}\n-# ${def.description}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("⚙️ Your Settings")
        .setDescription(lines.join("\n\n"));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "datepicker" || sub === "timepicker") {
      const value = interaction.options.getString("value");
      setSetting(userId, sub, value);
      return interaction.reply({
        content: `**${sub}** set to \`${value}\`.`,
        ephemeral: true,
      });
    }

    if (sub === "autoclockoutduration") {
      const duration = interaction.options.getInteger("duration");
      const unit = interaction.options.getString("unit") ?? "hours";

      if (duration === 0) {
        setSetting(userId, "autoclockoutduration", null);
        return interaction.reply({
          content: "Automatic clock-out is now **off**.",
          ephemeral: true,
        });
      }

      const minutes = duration * UNIT_MINUTES[unit];
      setSetting(userId, "autoclockoutduration", minutes);
      return interaction.reply({
        content:
          `You will be automatically clocked out after ` +
          `**${formatSettingValue("autoclockoutduration", minutes)}**.`,
        ephemeral: true,
      });
    }

    if (sub === "longshiftnotification") {
      const enabled = interaction.options.getBoolean("enabled");
      setSetting(userId, "longshiftnotification", enabled);
      return interaction.reply({
        content: enabled
          ? "Long-shift reminder DMs are **on**."
          : "Long-shift reminder DMs are **off**.",
        ephemeral: true,
      });
    }

    if (sub === "timezone") {
      const zone = interaction.options.getString("zone");

      if (zone.toLowerCase() === TZ_DEFAULT) {
        setSetting(userId, "timezone", null);
        return interaction.reply({
          content: `Timezone reset to the server default (${process.env.TIMEZONE || "not configured"}).`,
          ephemeral: true,
        });
      }

      if (!isValidTimezone(zone)) {
        return interaction.reply({
          content:
            `\`${zone}\` is not a valid timezone. Use an IANA name like ` +
            `\`America/New_York\` (the autocomplete lists valid zones).`,
          ephemeral: true,
        });
      }

      setSetting(userId, "timezone", zone);
      return interaction.reply({
        content: `Timezone set to **${zone}**. Dates you enter and view will use this zone.`,
        ephemeral: true,
      });
    }
  },
};
