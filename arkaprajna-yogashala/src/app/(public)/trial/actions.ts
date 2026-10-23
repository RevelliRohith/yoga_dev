"use server";
import { anonymousClient } from "@/lib/studio/public-data";
import {
  validateInquiry,
  StudioInputError,
  type ActionState,
} from "@/lib/studio/model";
import { isUuid } from "@/lib/admin/management";
export async function submitInquiry(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (
    process.env.PUBLIC_INQUIRIES_ENABLED !== "true" ||
    process.env.PUBLIC_CONTENT_ENABLED !== "true"
  )
    return {
      error:
        "Online inquiries are not accepting submissions yet. Please use the studio’s published contact details.",
      message: "",
    };
  try {
    const input = validateInquiry(form);
    const id = String(form.get("request_id") || "");
    if (!isUuid(id)) throw new StudioInputError("Reload the inquiry form.");
    const r = await anonymousClient().rpc("studio_submit_inquiry", {
      p_id: id,
      p_name: input.full_name,
      p_mobile: input.mobile,
      p_program: input.program,
      p_date: input.preferred_date,
      p_message: input.message,
      p_honeypot: "",
    });
    if (r.error)
      return {
        error:
          "Your inquiry could not be confirmed. Please wait before retrying or contact the studio. No registration is assumed.",
        message: "",
      };
    return {
      error: "",
      message:
        "Your inquiry was received. It does not reserve a class or register you as a student. The studio will review your request.",
    };
  } catch (e) {
    return {
      error:
        e instanceof StudioInputError
          ? e.message
          : "Check the inquiry details.",
      message: "",
    };
  }
}
