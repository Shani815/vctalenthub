import { useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Control, FieldValues } from "react-hook-form";

interface MultiSelectFieldProps<T extends FieldValues> {
  form: { control: Control<T> };
  name: string;
  label: string;
  options: string[];
}

const MultiSelectField = <T extends FieldValues>({ form, name, label, options }: MultiSelectFieldProps<T>) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <FormField
      control={form.control}
      name={name as string}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="space-y-2">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between"
                  >
                    {!field.value || field.value.length === 0
                      ? `Select ${label.toLowerCase()}...`
                      : `${field.value.length} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
                    <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {options.map((option) => (
                        <CommandItem
                          key={option}
                          onSelect={() => {
                            const currentValue = field.value || [];
                            const newValue = currentValue.includes(option)
                              ? currentValue.filter((s: string) => s !== option)
                              : [...currentValue, option];
                            field.onChange(newValue);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              field.value && field.value.includes(option)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {option}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex flex-wrap gap-2">
                {field.value && field.value.map((option: string) => (
                  <Badge
                    key={option}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => {
                      field.onChange(field.value.filter((s: string) => s !== option));
                    }}
                  >
                    {option} ×
                  </Badge>
                ))}
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default MultiSelectField;
